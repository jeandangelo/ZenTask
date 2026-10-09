import { addDays, getDaysInMonth } from 'date-fns';
import { friendlyDay, localDayKey } from './dates';
import { Area, ItemInput } from './types';

// Motor de reglas de la etapa 2 (docs/rediseno.md, sección 6): interpreta
// lo que se escribe en el Home sin IA. Es lógica pura y vive aparte para
// que la IA (etapa 6) lo reemplace y estas reglas queden de respaldo.
//
// Reglas:
// - Empieza con "comprar" → compra(s); "comprar leche, pan, palta" = 3.
// - "hoy", "mañana", "pasado mañana", un día de la semana, "el 14",
//   "14 de noviembre", "14/11" → fecha.
// - "a las 10", "10:30", "8pm", "a las 7 de la tarde" → hora.
// - Nombre de un área (o #área) → área.
// Si no hay "comprar" ni fecha ni hora, NO se crea nada: queda en el Buzón
// (un área sola no basta para saber qué es).

export interface ContextoReglas {
  areas: Pick<Area, 'id' | 'nombre'>[];
  ahora?: Date;
}

export interface Interpretacion {
  items: ItemInput[];
  reglas: string[];   // qué reglas reconocieron algo (se guarda en entradas.regla)
  resumen: string;    // texto de la tarjeta de resultado
}

// Límites de palabra que entienden tildes y ñ (\b de JS solo conoce ASCII)
const IZQ = '(^|[\\s,.;:¡¿!?()"\'])';
const DER = '(?=$|[\\s,.;:!?()"\'])';

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const DIAS: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const MESES: Record<string, number> = {
  ene: 0, enero: 0, feb: 1, febrero: 1, mar: 2, marzo: 2, abr: 3, abril: 3, may: 4, mayo: 4, jun: 5, junio: 5,
  jul: 6, julio: 6, ago: 7, agosto: 7, sep: 8, sept: 8, septiembre: 8, setiembre: 8, oct: 9, octubre: 9,
  nov: 10, noviembre: 10, dic: 11, diciembre: 11,
};

// Busca un patrón, devuelve la coincidencia y el texto sin ella
const extraer = (texto: string, patron: string): { m: RegExpMatchArray; resto: string } | null => {
  const re = new RegExp(IZQ + patron + DER, 'i');
  const m = texto.match(re);
  if (!m || m.index == null) return null;
  const inicio = m.index + m[1].length; // no comerse el separador de la izquierda
  return { m, resto: texto.slice(0, inicio) + ' ' + texto.slice(m.index + m[0].length) };
};

const pad = (n: number) => String(n).padStart(2, '0');

// ── Hora ─────────────────────────────────────────────────────────────────────
// Va ANTES que la fecha: así "de la mañana" se entiende como AM y no como
// "mañana" (el día siguiente).
const extraerHora = (texto: string): { hora: string; resto: string } | null => {
  const sufijo = '(?:\\s*(hrs?|hs|h|am|pm|a\\.m\\.|p\\.m\\.|de la ma[ñn]ana|de la tarde|de la noche))?';
  const patrones = [
    `(?:a\\s+las?|tipo|como\\s+a\\s+las)\\s+(\\d{1,2})(?:[:.](\\d{2}))?${sufijo}`,
    `(\\d{1,2})[:](\\d{2})${sufijo}`,
    `(\\d{1,2})\\s*(am|pm)`,
  ];
  for (const [i, p] of patrones.entries()) {
    const r = extraer(texto, p);
    if (!r) continue;
    const g = r.m.slice(2); // grupos después del separador izquierdo
    let h = parseInt(g[0], 10);
    const min = i === 2 ? 0 : parseInt(g[1] ?? '0', 10) || 0;
    const suf = sinTildes((i === 2 ? g[1] : g[2]) ?? '');
    if (/pm|p\.m\.|tarde|noche/.test(suf) && h < 12) h += 12;
    if (/am|a\.m\.|manana/.test(suf) && h === 12) h = 0;
    if (h > 23 || min > 59) continue;
    return { hora: `${pad(h)}:${pad(min)}`, resto: r.resto };
  }
  return null;
};

// ── Fecha ────────────────────────────────────────────────────────────────────
const extraerFecha = (texto: string, ahora: Date): { fecha: string; resto: string } | null => {
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  let r;

  if ((r = extraer(texto, 'pasado\\s+ma[ñn]ana'))) return { fecha: localDayKey(addDays(hoy, 2)), resto: r.resto };
  if ((r = extraer(texto, '(?:para\\s+)?hoy'))) return { fecha: localDayKey(hoy), resto: r.resto };
  // "mañana" = día siguiente, salvo "en/por/de la mañana" (= en la mañana)
  for (const m of texto.matchAll(new RegExp(IZQ + '(?:para\\s+)?ma[ñn]ana' + DER, 'gi'))) {
    const ini = (m.index ?? 0) + m[1].length;
    if (/(^|\s)la\s+$/i.test(texto.slice(0, ini))) continue;
    return { fecha: localDayKey(addDays(hoy, 1)), resto: texto.slice(0, ini) + ' ' + texto.slice((m.index ?? 0) + m[0].length) };
  }

  // "el jueves", "este viernes", "el próximo lunes": la próxima vez que toca
  // (si hoy es jueves, "el jueves" es el de la semana que viene)
  if ((r = extraer(texto, '(?:(?:para\\s+)?el\\s+|este\\s+|(?:el\\s+)?pr[oó]ximo\\s+)?(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)'))) {
    const dia = DIAS[sinTildes(r.m[2])];
    const diff = ((dia - hoy.getDay() + 7) % 7) || 7;
    return { fecha: localDayKey(addDays(hoy, diff)), resto: r.resto };
  }

  // "14 de noviembre", "el 14 de nov", "14 nov" → este año, o el próximo si ya pasó
  if ((r = extraer(texto, '(?:el\\s+)?(\\d{1,2})\\s+(?:de\\s+)?(ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sept?(?:iembre)?|setiembre|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?)'))) {
    const mes = MESES[sinTildes(r.m[3])];
    const fecha = fechaValida(hoy, parseInt(r.m[2], 10), mes);
    if (fecha) return { fecha, resto: r.resto };
  }

  // "14/11", "14-11", "14/11/2026"
  if ((r = extraer(texto, '(?:el\\s+)?(\\d{1,2})[/-](\\d{1,2})(?:[/-](\\d{2,4}))?'))) {
    const anio = r.m[4] ? (r.m[4].length === 2 ? 2000 + parseInt(r.m[4], 10) : parseInt(r.m[4], 10)) : undefined;
    const fecha = fechaValida(hoy, parseInt(r.m[2], 10), parseInt(r.m[3], 10) - 1, anio);
    if (fecha) return { fecha, resto: r.resto };
  }

  // "el 14" → este mes, o el próximo si ya pasó (exige "el" para no
  // confundirse con cantidades: "12 libros")
  if ((r = extraer(texto, '(?:para\\s+)?el\\s+(\\d{1,2})'))) {
    const d = parseInt(r.m[2], 10);
    let anio = hoy.getFullYear(), mes = hoy.getMonth();
    if (d < hoy.getDate()) { mes += 1; if (mes > 11) { mes = 0; anio += 1; } }
    if (d >= 1 && d <= getDaysInMonth(new Date(anio, mes, 1))) {
      return { fecha: localDayKey(new Date(anio, mes, d)), resto: r.resto };
    }
  }
  return null;
};

// Día + mes (año opcional); si no se da el año y la fecha ya pasó, es el año siguiente
const fechaValida = (hoy: Date, dia: number, mes: number, anio?: number): string | null => {
  if (mes < 0 || mes > 11 || dia < 1) return null;
  let y = anio ?? hoy.getFullYear();
  if (dia > getDaysInMonth(new Date(y, mes, 1))) return null;
  let f = new Date(y, mes, dia);
  if (anio == null && f < hoy) { y += 1; f = new Date(y, mes, dia); }
  return localDayKey(f);
};

// ── Área ─────────────────────────────────────────────────────────────────────
// "#cine" se quita del título; el nombre suelto ("estudiar para universidad")
// se deja, porque suele ser parte de la frase.
const extraerArea = (texto: string, areas: ContextoReglas['areas']): { area: Pick<Area, 'id' | 'nombre'>; resto: string } | null => {
  for (const a of [...areas].sort((x, y) => y.nombre.length - x.nombre.length)) {
    const nombre = sinTildes(a.nombre).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const t = sinTildes(texto);
    const conHash = t.match(new RegExp(IZQ + '#' + nombre + DER));
    if (conHash && conHash.index != null) {
      const ini = conHash.index + conHash[1].length;
      return { area: a, resto: texto.slice(0, ini) + texto.slice(ini + 1 + a.nombre.length) };
    }
    if (new RegExp(IZQ + nombre + DER).test(t)) return { area: a, resto: texto };
  }
  return null;
};

// Limpia lo que queda del texto para usarlo como título
const limpiar = (s: string) => {
  const t = s
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/^[\s,.;:–-]+|[\s,.;:–-]+$/g, '')
    // conectores que quedan colgando al sacar la fecha/hora ("… para el", "… el")
    .replace(/\s+(para|el|la|los|las|de|del|a|en)$/i, '')
    .trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
};

export function interpretar(texto: string, ctx: ContextoReglas): Interpretacion | null {
  const ahora = ctx.ahora ?? new Date();
  const reglas: string[] = [];
  let resto = ` ${texto.trim()} `;

  // "comprar" al principio (también "comprar:")
  const compra = /^\s*comprar\b[:\s]*/i.test(resto);
  if (compra) { reglas.push('compra'); resto = resto.replace(/^\s*comprar\b[:\s]*/i, ' '); }

  const h = extraerHora(resto);
  if (h) { reglas.push('hora'); resto = h.resto; }
  const f = extraerFecha(resto, ahora);
  if (f) { reglas.push('fecha'); resto = f.resto; }
  const a = extraerArea(resto, ctx.areas);
  if (a) { reglas.push('area'); resto = a.resto; }

  if (!compra && !f && !h) return null; // nada concreto: al Buzón

  // Hora sin fecha = hoy (una hora siempre necesita un día)
  const fecha = f?.fecha ?? (h ? localDayKey(ahora) : null);
  const base = { area_id: a?.area.id ?? null, fecha };

  if (compra) {
    // Separar por comas o "y" solo si son ítems cortos ("leche, pan y palta");
    // una frase larga con comas es UNA compra.
    const partes = resto.split(/,|\s+y\s+/i).map(limpiar).filter(Boolean);
    const lista = partes.length > 1 && partes.every(p => p.split(' ').length <= 4) ? partes : [limpiar(resto)].filter(Boolean);
    if (lista.length === 0) return null;
    const items = lista.map(titulo => ({ tipo: 'compra' as const, titulo, ...base }));
    const detalle = [fecha ? `antes del ${friendlyDay(fecha, localDayKey(ahora))}` : null, a?.area.nombre].filter(Boolean).join(' · ');
    return {
      items, reglas,
      resumen: `${lista.length === 1 ? 'Compra' : `${lista.length} compras`}: ${lista.join(', ')}${detalle ? ` · ${detalle}` : ''}`,
    };
  }

  const titulo = limpiar(resto);
  if (!titulo) return null;
  const detalle = [fecha ? friendlyDay(fecha, localDayKey(ahora)) : null, h?.hora, a?.area.nombre].filter(Boolean).join(' · ');
  return {
    items: [{ tipo: 'tarea', titulo, ...base, hora_inicio: h?.hora ?? null }],
    reglas,
    resumen: `Tarea: ${titulo}${detalle ? ` · ${detalle}` : ''}`,
  };
}
