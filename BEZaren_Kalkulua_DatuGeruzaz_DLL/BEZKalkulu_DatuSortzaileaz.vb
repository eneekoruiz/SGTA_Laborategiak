Imports DatuGeruza
Imports Lab01

Public Class BEZKalkulu_DatuSortzaileaz
    Private BK As BEZKalkulu

    Public Sub New(FakturaKodeaP As Integer)

        Dim ordTotal As Double
        Try
            ordTotal = DatuSortzailea.FakturarenTotala(FakturaKodeaP)
        Catch ex As Exception
            Throw New Exception("Faktura kode okerra")

        End Try
        Dim bezMota As Double
        Try
            bezMota = DatuSortzailea.FakturarenBEZMota(FakturaKodeaP)

        Catch ex As Exception
            Throw New Exception("Faktura kode okerra")

        End Try

            Dim bezEnum As BEZKalkulu.bezMotak
        Select Case CInt(Math.Round(bezMota))
            Case 21
                bezEnum = BEZKalkulu.bezMotak.Orokorra
            Case 10
                bezEnum = BEZKalkulu.bezMotak.Murriztua
            Case 5
                bezEnum = BEZKalkulu.bezMotak.Oinarrizkoa
            Case Else
                Throw New ArgumentException($"BEZ ezsezaguna: {bezMota}")
        End Select

        BK = New BEZKalkulu(ordTotal, bezEnum)
    End Sub

    Public Function TotalaBEZikGabe() As Double
        Return BK.totalaBEZGabe()
    End Function

    Public Function BEZa() As Double
        Return BK.ordBEZ()
    End Function
End Class