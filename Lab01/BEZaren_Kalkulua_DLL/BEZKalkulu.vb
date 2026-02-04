Public Class BEZKalkulu
    Private ordTotal As Double
    Private bezMota As bezMotak
    Enum bezMotak
        Orokorra = 21
        Murriztua = 10
        Oinarrizkoa = 5
    End Enum

    Public Function totalaBEZGabe() As Double
        Return ordTotal / (1 + CDbl(bezMota) / 100)
    End Function

    Public Function ordBEZ() As Double
        Return ordTotal - totalaBEZGabe()
    End Function

    Public Sub New(ordTotalP As Double, bezMotaP As bezMotak)
        ordTotal = ordTotalP
        bezMota = bezMotaP
    End Sub

End Class
