Imports System.Data.SqlClient
Imports loginetaerregistratu
Imports Salbuespenak

Module ProbatuDatuAtzipena
    Private DatuAtzipena As DatuAtzipena
    Public Sub Main()

        'System.Console.WriteLine("Probatu erabiltzailea gehitu")
        'Try
        'DatuAtzipena.ErabiltzaileaGehitu("a@pproba.a", "123")
        'System.Console.WriteLine("Gordeta")
        'Catch ex As Exception
        'Console.WriteLine("ERROREA:")
        'Console.WriteLine(ex.Message)
        'End Try
        Randomize()
        Dim egiaztatzeZenbakia As Long
        egiaztatzeZenbakia = CLng(Rnd() * 1234567) + 1000000
        System.Console.WriteLine("Probatu erabiltzailea gehitu")
        Try
            DatuAtzipena.ErabiltzaileaGehitu("a@p.a", "proba", "p", "lsjdh", "holi", 123456, egiaztatzeZenbakia, "123")
            System.Console.WriteLine("Gordeta")
        Catch ex As Exception
            Console.WriteLine("ERROREA:")
            Console.WriteLine(ex.Message)
        End Try

        System.Console.WriteLine("Probatu erabiltzailea lortu")
        Try
            Dim emaitza As SqlDataReader = DatuAtzipena.ErabiltzaileaLortu("a@pproba.a")
            If emaitza.Read() Then
                System.Console.WriteLine("Erabiltzailea aurkitu da: " + emaitza("email").ToString())
            Else
                System.Console.WriteLine("Erabiltzailea ez da aurkitu")
            End If
            DatuAtzipena.ItxiKonexioa()
        Catch ex As Exception
            Console.WriteLine("ERROREA:")
            Console.WriteLine(ex.Message)
        End Try

        'System.Console.WriteLine("Probatu erabiltzailea egiaztatu")
        'Try
        'Dim emaitza As Integer = DatuAtzipena.ErabiltzaileaEgiaztatu("a@pproba.a")
        'If emaitza > 0 Then
        'System.Console.WriteLine("Erabiltzailea egiaztatu da")
        'Else
        'System.Console.WriteLine("Erabiltzailea ez da egiaztatu")
        'End If
        'Catch ex As Exception
        'Console.WriteLine("ERROREA:")
        'Console.WriteLine(ex.Message)
        'End Try
        System.Console.WriteLine("Probatu erabiltzailearen pasahitza eguneratzea")
        Try
            Dim emaitza As Integer = DatuAtzipena.ErabiltzailearenPasahitzaAldatu("a@pproba.a", "1234")
            If emaitza > 0 Then
                System.Console.WriteLine("Erabiltzailearen pasahitza eguneratu da")
            Else
                System.Console.WriteLine("Erabiltzailearen pasahitza ez da eguneratu")
            End If
        Catch ex As Exception
            Console.WriteLine("ERROREA:")
            Console.WriteLine(ex.Message)
        End Try
    End Sub

End Module

