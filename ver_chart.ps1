# ============================================================================
# SCRIPT: ver_chart.ps1
# OBJETIVO: atajo para correr ver_chart.py con el Python 32 bits del sistema
# (necesario por los drivers ODBC de Sage), sin tener que acordarse del
# comando "py -3.13-32" cada vez.
#
# Uso:
#   .\ver_chart.ps1 DSN_SageOficinaPrueba
#   .\ver_chart.ps1 DSN_SageOficinaPrueba -Limite 0
# ============================================================================

param(
    [Parameter(Mandatory = $true)]
    [string]$Dsn,

    [int]$Limite = 20
)

Set-Location $PSScriptRoot
py -3.13-32 ver_chart.py $Dsn --limite $Limite
