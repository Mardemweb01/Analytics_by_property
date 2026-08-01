import { describe, expect, it } from 'vitest'

import {
  formatearFecha,
  formatearMesAno,
  formatearMesCorto,
  formatearMoneda,
  formatearNumero,
  formatearPorcentaje,
  formatearVariacion,
} from './format'

/**
 * Construye el importe esperado con el espacio duro (U+00A0) que separa el
 * símbolo del número.
 *
 * Se escribe con el escape ` ` a propósito: pegar el carácter literal en
 * el test lo volvería indistinguible de un espacio normal a simple vista, y un
 * fallo por esa diferencia produce el mensaje más desconcertante que existe
 * ("expected 'B/. 1' to be 'B/. 1'").
 */
const moneda = (texto: string) => `B/. ${texto}`

describe('formatearMoneda', () => {
  it('usa el símbolo del balboa y sin decimales por defecto', () => {
    expect(formatearMoneda(142_580)).toBe(moneda('142,580'))
  })

  it('redondea al entero más cercano cuando no se piden decimales', () => {
    expect(formatearMoneda(142_580.5)).toBe(moneda('142,581'))
  })

  it('respeta los decimales solicitados', () => {
    expect(formatearMoneda(1_234.5, { decimales: 2 })).toBe(moneda('1,234.50'))
  })

  it('mantiene el signo en importes negativos', () => {
    expect(formatearMoneda(-58_320)).toContain('58,320')
    expect(formatearMoneda(-58_320).startsWith('-')).toBe(true)
  })

  it('abrevia miles y millones en modo compacto', () => {
    expect(formatearMoneda(142_580, { compacto: true })).toBe(moneda('142.6K'))
    expect(formatearMoneda(2_400_000, { compacto: true })).toBe(moneda('2.4M'))
  })

  it('omite el decimal compacto cuando no aporta', () => {
    expect(formatearMoneda(60_000, { compacto: true })).toBe(moneda('60K'))
  })

  it('usa el mismo separador en el camino normal y en el compacto', () => {
    // Ambos caminos construyen el string de forma distinta (Intl vs
    // concatenación): esta prueba evita que se desincronicen.
    const normal = formatearMoneda(60_000)
    const compacto = formatearMoneda(60_000, { compacto: true })

    expect(normal.slice(0, 4)).toBe(compacto.slice(0, 4))
  })

  it('devuelve un guion ante valores no finitos', () => {
    expect(formatearMoneda(Number.NaN)).toBe('—')
    expect(formatearMoneda(Number.POSITIVE_INFINITY)).toBe('—')
  })
})

describe('formatearPorcentaje', () => {
  it('recibe el número tal como se muestra, no una fracción', () => {
    // Es el error fácil de cometer al consumir esta capa: 92 => "92%",
    // NO 0.92.
    expect(formatearPorcentaje(92)).toBe('92%')
  })

  it('respeta los decimales solicitados', () => {
    expect(formatearPorcentaje(8.75, 1)).toBe('8.8%')
  })
})

describe('formatearVariacion', () => {
  it('fuerza el signo en variaciones positivas', () => {
    expect(formatearVariacion(8.7)).toBe('+8.7%')
  })

  it('conserva el signo en variaciones negativas', () => {
    expect(formatearVariacion(-2.1)).toBe('-2.1%')
  })

  it('muestra cero sin signo', () => {
    // "+0.0%" se lee como un cambio que no existe.
    expect(formatearVariacion(0)).toBe('0%')
  })
})

describe('formatearNumero', () => {
  it('agrupa los miles sin símbolo de moneda', () => {
    expect(formatearNumero(6_521)).toBe('6,521')
  })
})

describe('fechas', () => {
  it('capitaliza el mes completo', () => {
    expect(formatearMesAno('2026-05-15')).toBe('Mayo 2026')
  })

  it('capitaliza y limpia el punto del mes corto', () => {
    expect(formatearMesCorto('2026-04-15')).toBe('Abr 2026')
  })

  it('formatea una fecha completa en español', () => {
    expect(formatearFecha('2026-05-28')).toBe('28 may 2026')
  })
})
