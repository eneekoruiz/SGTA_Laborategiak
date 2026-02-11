Imports System.Data.SqlClient
Imports loginetaerregistratu

Public Class PasahitzaAldatu
    Inherits System.Web.UI.Page
    Public erab As SqlDataReader
    Protected Sub Page_Load(ByVal sender As Object, ByVal e As System.EventArgs) Handles Me.Load
        Dim email As String = Request.QueryString("erab")
        If Session("erab") Is Nothing Then
            Session.Clear()
            Response.Redirect("Hasiera.aspx")
        End If

        Dim emailSesion As String = Session("erab").ToString()

        If email Is Nothing OrElse email <> emailSesion Then
            Session.Clear()
            Response.Redirect("Hasiera.aspx")
            Return
        End If
    End Sub



    Protected Sub Button1_Click(sender As Object, e As EventArgs) Handles Button1.Click
        Dim email As String = Request.QueryString("erab")

        Dim passAntigua As String = TextBox1.Text
        Dim passBerria As String = TextBox3.Text
        Dim passErrepikatu As String = TextBox2.Text

        Label4.ForeColor = Drawing.Color.Red
        Label4.Text = ""

        If ErroreaDago(DatuAtzipena.BalidatuPasahitza(passBerria), TextBox3) Then Return

        If passBerria <> passErrepikatu Then
            Label4.Text = "Errorea: Pasahitz berriak ez datoz bat."
            TextBox2.Focus()
            Return
        End If

        If passAntigua = passBerria Then
            Label4.Text = "Errorea: Pasahitza berria ezin da zaharraren berdina izan."
            TextBox3.Focus()
            Return
        End If

        Try
            Dim erab As System.Data.SqlClient.SqlDataReader = DatuAtzipena.ErabiltzaileaLortu(email)
            Dim passBDSartuta As String = ""
            Dim erabiltzaileaExistitzenDa As Boolean = False

            If erab.Read() Then
                passBDSartuta = erab("pasahitza").ToString()
                erabiltzaileaExistitzenDa = True
            End If

            erab.Close()
            DatuAtzipena.ItxiKonexioa()

            If erabiltzaileaExistitzenDa Then
                If passBDSartuta = passAntigua Then
                    DatuAtzipena.ErabiltzailearenPasahitzaAldatu(email, passBerria)

                    Label4.ForeColor = Drawing.Color.Green
                    Label4.Text = "Pasahitza ondo aldatu da."
                    TextBox1.Text = ""
                    TextBox2.Text = ""
                    TextBox3.Text = ""
                Else
                    Label4.Text = "Errorea: Uneko pasahitza ez da zuzena."
                End If
            Else
                Label4.Text = "Errorea: Erabiltzailea ez da aurkitu."
            End If

        Catch ex As Exception
            Label4.Text = "Errore teknikoa: " & ex.Message
        End Try

    End Sub

    Protected Sub Button2_Click(sender As Object, e As EventArgs) Handles Button2.Click
        Response.Redirect("Login.aspx")

    End Sub

    Private Function ErroreaDago(mezua As String, txt As TextBox) As Boolean
        If mezua <> "" Then
            Label4.ForeColor = Drawing.Color.Red
            Label4.Text = mezua
            txt.Focus()
            Return True
        End If
        Return False
    End Function

End Class