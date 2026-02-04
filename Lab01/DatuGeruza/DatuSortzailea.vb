Public Class DatuSortzailea
    Private Shared FakturenZenbatekoakEtaBEZMotak = New Double(,) {{2500, 10}, {3150.55, 21}, {25000, 21}, {315.25, 5}}

    Private Sub New()
    End Sub

    Public Shared Function FakturarenTotala(FakturaKodea As Integer) As Double
        If (FakturaKodea + 1 < 1 OrElse FakturaKodea >= FakturenZenbatekoakEtaBEZMotak.GetLength(0)) Then
            Throw New Exception("Faktura kode okerra")
        Else
            Dim balioa1 = FakturenZenbatekoakEtaBEZMotak(FakturaKodea, 0)
            Return balioa1
        End If
    End Function

    Public Shared Function FakturarenBEZMota(FakturaKodea As Integer) As Double
        If (FakturaKodea + 1 < 1 OrElse FakturaKodea >= FakturenZenbatekoakEtaBEZMotak.GetLength(0)) Then
            Throw New Exception("Faktura kode okerra")
        Else
            Dim balioa2 = FakturenZenbatekoakEtaBEZMotak(FakturaKodea, 1)
            Return balioa2
        End If
    End Function
End Class
