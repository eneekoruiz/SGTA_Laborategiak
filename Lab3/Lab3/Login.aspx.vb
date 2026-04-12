Imports System
Imports System.Data.SqlClient
Imports System.Web
Imports loginetaerregistratu



Public Class Login
    Inherits System.Web.UI.Page

    Protected Sub Button1_Click(sender As Object, e As EventArgs) Handles Button1.Click
        Response.Redirect("Erregistratu.aspx")

    End Sub

    Protected Sub Button2_Click(sender As Object, e As EventArgs) Handles Button2.Click
        Dim email As String = txtEmail.Text
        Dim password As String = txtPassword.Text
        Label1.ForeColor = Drawing.Color.Red
        Label1.Text = ""
        If ErroreaDago(DatuAtzipena.BalidatuEmaila(email), txtEmail) Then Return
        If ErroreaDago(DatuAtzipena.BalidatuTestua(password, "Pasahitza"), txtPassword) Then Return
        Try
            Dim erabiltzailea As SqlDataReader = DatuAtzipena.ErabiltzaileaLortu(email)
            If erabiltzailea.Read() Then
                HyperLink1.NavigateUrl = "PasahitzaBerreskuratu.aspx?erab=" & email
                Dim pasahitzaDB As String = erabiltzailea("pasahitza").ToString()

                If pasahitzaDB = password Then
                    Session("erab") = email
                    If erabiltzailea("erabiltzaileMota").ToString() = "ik" Then
                        Response.Redirect("~/Erreg/Ikasleak/Ikasleak.aspx?erab=" & email)
                    Else
                        Response.Redirect("~/Erreg/Irakasleak/Irakasleak.aspx?erab=" & email)

                    End If
                Else
                    Label1.Text = "Pasahitza okerra."
                End If
            Else
                Label1.Text = "Erabiltzailea ez da existitzen."
            End If
            erabiltzailea.Close()
            DatuAtzipena.ItxiKonexioa()
        Catch ex As Exception
            Label1.Text = "Errorea gertatu da erabiltzailea lortzean."
        End Try
    End Sub

    Protected Sub txtPassword_TextChanged(sender As Object, e As EventArgs) Handles txtPassword.TextChanged

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