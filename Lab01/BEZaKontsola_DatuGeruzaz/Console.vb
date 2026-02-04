Imports BEZaren_Kalkulua_DatuGeruzaz_DLL

Module Console
    Private BEZKalkulu_DatuSortzaileaz As BEZKalkulu_DatuSortzaileaz

    Sub Main()
        Try
            Dim fakturaKodea As Integer
            System.Console.WriteLine("Sartu faktura-kodea: ")
            fakturaKodea = Integer.Parse(System.Console.ReadLine()) - 1
            BEZKalkulu_DatuSortzaileaz = New BEZKalkulu_DatuSortzaileaz(fakturaKodea)
            System.Console.WriteLine("Totala BEZik gabe: " & BEZKalkulu_DatuSortzaileaz.TotalaBEZikGabe())
            System.Console.WriteLine("BEZa: " & BEZKalkulu_DatuSortzaileaz.BEZa())
        Catch ex As Exception
            System.Console.WriteLine("ERROREA!")
        End Try
    End Sub

End Module
