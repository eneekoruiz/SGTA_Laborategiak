Imports System.Data.SqlClient
Imports System.Net
Imports System.Net.Mail
Imports System.Text.RegularExpressions
Imports Salbuespenak

Public Class DatuAtzipena
    Private Shared konexioa As SqlConnection
    Private Sub New()

    End Sub
    Public Shared Sub Konektatu()
        Dim strKonexioa As String = "Server = tcp : taldea08i.database.windows.net, 1433;Initial Catalog=SGTA2026;Persist Security Info=False;User ID=iurgoitia002@ikasle.ehu.eus@taldea08i;Password=sgta2026!;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
        Try
            konexioa = New SqlConnection(strKonexioa)
            konexioa.Open()
        Catch ex As ErroreaKonektatzean
            Throw New ErroreaKonektatzean()
        End Try
    End Sub
    Public Shared Sub ItxiKonexioa()
        Try
            konexioa.Close()
        Catch ex As ErroreaKonexioaIxtean
            Throw New ErroreaKonexioaIxtean()

        End Try
    End Sub
    Public Shared Function ErabiltzaileaGehitu(ByVal strEmail As String, ByVal strIzena As String, ByVal strAbizena As String, ByVal strGaldera As String, ByVal strErantzuna As String, ByVal intNa As Integer, ByVal intEgiaztatzeZenb As Integer, ByVal strPasahitza As String) As Integer
        Konektatu()
        Dim SqlCommandGehitu = New SqlCommand("INSERT INTO Erabiltzaileak (email, izena, abizena, galderaEzkutua, erantzuna, na, egiaztatzeZenbakia, pasahitza) VALUES ('" & strEmail & "', '" & strIzena & "', '" & strAbizena & "', '" & strGaldera & "', '" & strErantzuna & "', '" & intNa & "', '" & intEgiaztatzeZenb & "', '" & strPasahitza & "')", konexioa)
        Try
            Return SqlCommandGehitu.ExecuteNonQuery()
        Catch ex As ErroreaGehitzean
            Throw New ErroreaGehitzean()
        Finally
            ItxiKonexioa()
        End Try
    End Function

    Public Shared Function ErabiltzaileaLortu(ByVal strEmail As String) As SqlDataReader
        Konektatu()
        Dim SqlCommandLortu = New SqlCommand("SELECT * FROM Erabiltzaileak WHERE email='" & strEmail & "'", konexioa)
        Try
            Return SqlCommandLortu.ExecuteReader()
        Catch ex As ErroreaLortzean
            Throw New ErroreaLortzean()
        End Try
    End Function

    Public Shared Function ErabiltzaileaEgiaztatu(ByVal strEmail As String) As Integer
        Konektatu()

        Dim SqlCommandEgiaztatu = New SqlCommand("UPDATE Erabiltzaileak SET egiaztatua=1 WHERE email='" & strEmail & "'", konexioa)
        Try
            Return SqlCommandEgiaztatu.ExecuteNonQuery()
        Catch ex As ErroreaEgiaztatzean
            Throw New ErroreaEgiaztatzean()
        Finally
            ItxiKonexioa()
        End Try
    End Function

    Public Shared Function ErabiltzailearenPasahitzaAldatu(ByVal strEmail As String, ByVal strPasahitzaBerria As String) As Integer
        Konektatu()
        Dim SqlCommandAldatu = New SqlCommand("UPDATE Erabiltzaileak SET pasahitza='" & strPasahitzaBerria & "' WHERE email='" & strEmail & "' ", konexioa)
        Try
            Return SqlCommandAldatu.ExecuteNonQuery()
        Catch ex As ErroreaPasahitzaAldatzean
            Throw New ErroreaPasahitzaAldatzean()
        Finally
            ItxiKonexioa()
        End Try
    End Function

    Public Shared Sub BidaliEmaila(nora As String, asuntoa As String, gorputza As String)

        Dim smtp As New SmtpClient("smtp.gmail.com", 587)

        smtp.EnableSsl = True
        smtp.UseDefaultCredentials = False
        smtp.DeliveryMethod = SmtpDeliveryMethod.Network
        smtp.Credentials = New NetworkCredential("SARTU HEMEN ZURE ERABILTZAILEA", "SARTU HEMEN ZURE PASAHITZA")

        Dim mensaje As New MailMessage()
        mensaje.From = New MailAddress("SARTU HEMEN ZURE ERABILTZAILEA")
        mensaje.To.Add(nora)
        mensaje.Subject = asuntoa
        mensaje.Body = gorputza
        mensaje.IsBodyHtml = False

        smtp.Send(mensaje)

    End Sub

    Public Shared Function BalidatuTestua(ByVal testua As String, ByVal eremuIzena As String) As String
        If String.IsNullOrWhiteSpace(testua) Then
            Return "Errorea: " & eremuIzena & " eremua derrigorrezkoa da."
        End If
        Return ""
    End Function


    Public Shared Function BalidatuNAN(ByVal nan As String) As String
        If String.IsNullOrWhiteSpace(nan) Then
            Return "Errorea: NAN zenbakia derrigorrezkoa da."
        End If

        If nan.Length < 8 Then
            Return "Errorea: NANak ez du luzera zuzena."
        End If

        Return ""
    End Function

    Public Shared Function BalidatuPasahitza(ByVal pasahitza As String) As String
        If String.IsNullOrWhiteSpace(pasahitza) Then
            Return "Errorea: Pasahitza derrigorrezkoa da."
        End If

        If pasahitza.Length < 6 Then
            Return "Errorea: Pasahitzak gutxienez 6 karaktere izan behar ditu."
        End If

        Return ""
    End Function

    Public Shared Function IkasleaMatrikulatutakoIrakasgaienEgokitzaileaEskuratu(ByVal email As String) As SqlDataAdapter
        Dim da As SqlDataAdapter = Nothing
        Try
            Konektatu()
            Dim sql As String = "SELECT DISTINCT irakasgaiKodea FROM KlasekoTaldeak WHERE kodea IN " &
                               "(SELECT taldeKodea FROM IkasleakTaldeak WHERE email = @email)"
            Dim cmd As New SqlCommand(sql, konexioa)
            cmd.Parameters.AddWithValue("@email", email)
            da = New SqlDataAdapter(cmd)
        Catch ex As Exception
            Throw New Exception("Errorea irakasgaiak eskuratzean: " & ex.Message)
        Finally
            ItxiKonexioa()
        End Try
        Return da
    End Function

    Public Shared Function UstiapenekoLanGenerikoenEgokitzaileaEskuratu(ByVal email As String) As SqlDataAdapter
        Dim da As SqlDataAdapter = Nothing
        Try
            Konektatu()
            Dim sql As String = "SELECT lg.* FROM LanGenerikoak lg " &
                               "INNER JOIN KlasekoTaldeak kt ON lg.irakasgaiKodea = kt.irakasgaiKodea " &
                               "WHERE kt.kodea IN (SELECT it.taldeKodea FROM IkasleakTaldeak it WHERE it.email = @email) " &
                               "AND NOT EXISTS (SELECT 1 FROM IkasleakLanak il WHERE il.email = @email AND il.lanGenerikoarenKodea = lg.kodea)"
            Dim cmd As New SqlCommand(sql, konexioa)
            cmd.Parameters.AddWithValue("@email", email)
            da = New SqlDataAdapter(cmd)
        Catch ex As Exception
            Throw New Exception("Errorea lanak eskuratzean: " & ex.Message)
        Finally
            ItxiKonexioa()
        End Try
        Return da
    End Function

    Public Shared Function IkasleLanEgokitzaileaEskuratu(ByVal email As String) As SqlDataAdapter
        Dim da As SqlDataAdapter = Nothing
        Try
            Konektatu()
            Dim sql As String = "SELECT * FROM IkasleakLanak WHERE email = @email"
            Dim cmd As New SqlCommand(sql, konexioa)
            cmd.Parameters.AddWithValue("@email", email)
            da = New SqlDataAdapter(cmd)
        Catch ex As Exception
            Throw New Exception("Errorea ikasle lanak eskuratzean: " & ex.Message)
        Finally
            ItxiKonexioa()
        End Try
        Return da
    End Function

    Public Shared Function LanGenerikoEgokitzaileaEskuratu() As SqlDataAdapter
        Dim da As SqlDataAdapter = Nothing
        Try
            Konektatu()
            da = New SqlDataAdapter("SELECT * FROM LanGenerikoak", konexioa)
        Catch ex As Exception
            Throw New Exception("Errorea lan generikoak eskuratzean")
        Finally
            ItxiKonexioa()
        End Try
        Return da
    End Function

    Public Shared Function IrakasgaiKodeenTaulaLortu() As DataTable
        Dim dt As New DataTable()
        Try
            Konektatu()
            Dim sql As String = "SELECT kodea FROM Irakasgaiak"
            Dim da As New SqlDataAdapter(sql, konexioa)
            da.Fill(dt)
        Catch ex As Exception
            Throw New Exception("Errorea irakasgaiak lortzean")
        Finally
            ItxiKonexioa()
        End Try
        Return dt
    End Function


    Public Shared Function ErabiltzaileaGehitu(ByVal strEmail As String, ByVal strIzena As String, ByVal strAbizena As String,
                                              ByVal strGaldera As String, ByVal strErantzuna As String, ByVal intNa As Integer,
                                              ByVal intEgiaztatzeZenb As Integer, ByVal strErabiltzaileMota As String,
                                              ByVal strPasahitza As String) As Integer
        Try
            Konektatu()
            Dim sql As String = "INSERT INTO Erabiltzaileak (email, izena, abizena, galderaEzkutua, erantzuna, na, egiaztatzeZenbakia, erabiltzaileMota, pasahitza) " &
                               "VALUES (@email, @izena, @abizena, @galdera, @erantzuna, @na, @egiaztatu, @mota, @pass)"

            Using cmd As New SqlCommand(sql, konexioa)
                cmd.Parameters.AddWithValue("@email", strEmail)
                cmd.Parameters.AddWithValue("@izena", strIzena)
                cmd.Parameters.AddWithValue("@abizena", strAbizena)
                cmd.Parameters.AddWithValue("@galdera", strGaldera)
                cmd.Parameters.AddWithValue("@erantzuna", strErantzuna)
                cmd.Parameters.AddWithValue("@na", intNa)
                cmd.Parameters.AddWithValue("@egiaztatu", intEgiaztatzeZenb)
                cmd.Parameters.AddWithValue("@mota", strErabiltzaileMota)
                cmd.Parameters.AddWithValue("@pass", strPasahitza)

                Return cmd.ExecuteNonQuery()
            End Using
        Catch ex As Exception
            Throw New Exception("Errorea erabiltzailea gehitzean: " & ex.Message)
        Finally
            ItxiKonexioa()
        End Try
    End Function

    Public Shared Function BalidatuEmaila(ByVal emaila As String) As String
        If String.IsNullOrWhiteSpace(emaila) Then
            Return "Errorea: Emaila derrigorrezkoa da."
        End If

        Dim patroia As String = "^[a-zA-Z0-9._%+-]+@(ehu\.eus|ikasle\.ehu\.eus)$"

        If Not Regex.IsMatch(emaila, patroia, RegexOptions.IgnoreCase) Then
            Return "Errorea: Emailak @ehu.eus edo @ikasle.ehu.eus domeinukoa izan behar du."
        End If

        Return ""
    End Function


End Class
