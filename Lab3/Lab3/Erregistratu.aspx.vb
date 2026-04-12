Imports System
Imports loginetaerregistratu
Public Class Erregistratu
    Inherits System.Web.UI.Page

    Protected Sub Page_Load(ByVal sender As Object, ByVal e As System.EventArgs) Handles Me.Load

    End Sub

    Protected Sub Button1_Click(sender As Object, e As EventArgs) Handles Button1.Click
        Dim emaila As String = TextBox1.Text.Trim()
        Dim izena As String = TextBox2.Text
        Dim abizena As String = TextBox3.Text
        Dim galdera As String = TextBox4.Text
        Dim erantzuna As String = TextBox5.Text
        Dim na As String = TextBox6.Text
        Dim pasahitza As String = TextBox7.Text

        Label1.ForeColor = Drawing.Color.Red
        Label1.Text = ""

        If ErroreaDago(DatuAtzipena.BalidatuEmaila(emaila), TextBox1) Then Return
        If ErroreaDago(DatuAtzipena.BalidatuTestua(izena, "Izena"), TextBox2) Then Return
        If ErroreaDago(DatuAtzipena.BalidatuTestua(abizena, "Abizena"), TextBox3) Then Return

        If ErroreaDago(DatuAtzipena.BalidatuNAN(na), TextBox6) Then Return
        If ErroreaDago(DatuAtzipena.BalidatuTestua(galdera, "Galdera ezkutua"), TextBox4) Then Return
        If ErroreaDago(DatuAtzipena.BalidatuTestua(erantzuna, "Erantzuna"), TextBox5) Then Return
        If ErroreaDago(DatuAtzipena.BalidatuPasahitza(pasahitza), TextBox7) Then Return
        Randomize()
        Dim egiaztatzeZenbakia As Long
        egiaztatzeZenbakia = CLng(Rnd() * 1234567) + 1000000
        Label1.Text = ""
        Try
            If emaila.EndsWith("@ikasle.ehu.eus", StringComparison.OrdinalIgnoreCase) Then
                Dim erabMota As String = "ik"
                DatuAtzipena.ErabiltzaileaGehitu(emaila, izena, abizena, galdera, erantzuna, na, egiaztatzeZenbakia, erabMota, pasahitza)
            ElseIf emaila.EndsWith("@ehu.eus", StringComparison.OrdinalIgnoreCase) Then
                Dim erabMota As String = "irak"
                DatuAtzipena.ErabiltzaileaGehitu(emaila, izena, abizena, galdera, erantzuna, na, egiaztatzeZenbakia, erabMota, pasahitza)
            End If

            hlEgiaztatu.NavigateUrl = "Egiaztatu.aspx?erab=" & emaila & "&egZenb=" & egiaztatzeZenbakia
            hlEgiaztatu.Visible = True
            Label1.ForeColor = Drawing.Color.Green
            Label1.Text = "Erabiltzailea ondo erregistratu da."
            Try
                Dim asuntoa As String = "Erregistratu zure kontua"
                Dim link As String = "https://localhost:" & Request.ServerVariables("SERVER_PORT") & "/Egiaztatu.aspx?erab=" & emaila & "&egZenb=" & egiaztatzeZenbakia
                Dim gorputza As String = "Kaixo " & izena & ", zure kontua erregistratu da. Egiaztatu zure emaila honako esteka honetan: " & link

                DatuAtzipena.BidaliEmaila(emaila, asuntoa, gorputza)
            Catch exMail As Exception
                Label1.Text &= " (Baina emaila ezin izan da bidali: " & exMail.Message & ")"
            End Try

        Catch ex As Exception
            Label1.ForeColor = Drawing.Color.Red
            Label1.Text = "Errorea gertatu da erabiltzailea erregistratzean." & ex.Message
        End Try

    End Sub

    Private Function ErroreaDago(mezua As String, txt As TextBox) As Boolean
        If mezua <> "" Then
            Label1.Text = mezua
            txt.Focus()
            Return True
        End If
        Return False
    End Function
End Class