import { describe, expect, it } from 'vitest'

import { calcularSparkline, direccionSerie } from './sparkline'

const OPCIONES = { ancho: 100, alto: 40 }

describe('calcularSparkline', () => {
  it('devuelve un trazado vacío cuando no hay datos', () => {
    const resultado = calcularSparkline([], OPCIONES)

    expect(resultado.linea).toBe('')
    expect(resultado.area).toBe('')
    expect(resultado.ultimoPunto).toBeNull()
  })

  it('dibuja una línea horizontal centrada con un único valor', () => {
    // Un solo punto no define pendiente: debe leerse como "sin variación",
    // no como un trazo roto.
    const resultado = calcularSparkline([500], OPCIONES)

    expect(resultado.linea).toBe('M 0 20 L 100 20')
    expect(resultado.ultimoPunto).toEqual({ x: 100, y: 20 })
  })

  it('centra la serie cuando todos los valores son iguales', () => {
    // El caso peligroso: rango 0 provocaría división por cero.
    const resultado = calcularSparkline([300, 300, 300], OPCIONES)

    expect(resultado.linea).not.toContain('NaN')
    expect(resultado.ultimoPunto?.y).toBe(20)
  })

  it('ubica el valor máximo arriba y el mínimo abajo', () => {
    // El eje Y de SVG crece hacia abajo: el mayor valor debe tener la menor Y.
    const { linea } = calcularSparkline([10, 50], { ancho: 100, alto: 40, margen: 0 })

    expect(linea).toBe('M 0 40 L 100 0')
  })

  it('normaliza contra el rango propio de la serie, no contra cero', () => {
    // Dos series con el mismo rango relativo pero magnitudes muy distintas
    // deben producir la misma forma: el sparkline comunica forma, no magnitud.
    const chica = calcularSparkline([10, 20, 30], OPCIONES)
    const grande = calcularSparkline([100_010, 100_020, 100_030], OPCIONES)

    expect(chica.linea).toBe(grande.linea)
  })

  it('reparte los puntos de forma uniforme a lo ancho', () => {
    const { linea } = calcularSparkline([1, 2, 3, 4, 5], { ancho: 100, alto: 40, margen: 0 })
    const coordenadasX = [...linea.matchAll(/[ML] ([\d.]+)/g)].map((m) => Number(m[1]))

    expect(coordenadasX).toEqual([0, 25, 50, 75, 100])
  })

  it('cierra el área contra la base del viewBox', () => {
    const { area } = calcularSparkline([10, 20], OPCIONES)

    expect(area.endsWith('L 100 40 L 0 40 Z')).toBe(true)
  })
})

describe('direccionSerie', () => {
  it('detecta una serie ascendente', () => {
    expect(direccionSerie([1, 5, 3, 9])).toBe('up')
  })

  it('detecta una serie descendente', () => {
    expect(direccionSerie([9, 3, 5, 1])).toBe('down')
  })

  it('trata como plana una serie que empieza y termina igual', () => {
    expect(direccionSerie([5, 100, 5])).toBe('flat')
  })

  it('trata como plana una serie vacía', () => {
    expect(direccionSerie([])).toBe('flat')
  })
})
