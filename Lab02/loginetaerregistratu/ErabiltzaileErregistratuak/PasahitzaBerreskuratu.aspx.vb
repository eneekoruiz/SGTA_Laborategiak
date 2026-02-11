Imports System.Data.SqlClient
Imports loginetaerregistratu

Public Class PasahitzaBerreskkuratu
    Inherits System.Web.UI.Page

    ' Nota: No es recomendable guardar el SqlDataReader como variable global en Web Forms
    ' porque la conexión suele cerrarse al terminar el ciclo de vida de la página.

    Protected Sub Page_Load(ByVal sender As Object, ByVal e As System.EventArgs) Handles Me.Load
        If Not IsPostBack Then
            Dim email As String = Request.QueryString("erab")
            If String.IsNullOrEmpty(email) Then
                Label2.Text = "Ez da erabiltzailerik zehaztu."
                Return
            End If

            ' Obtenemos los datos solo para mostrar la pregunta
            Using erab As SqlDataReader = DatuAtzipena.ErabiltzaileaLortu(email)
                If erab.Read() Then
                    Label1.Text = erab("galderaEzkutua").ToString()
                Else
                    Label2.Text = "Erabiltzailea ez da existitzen."
                    Button2.Enabled = False ' Desactivamos el botón si no hay usuario
                End If
            End Using
        End If
    End Sub

    Protected Sub Button1_Click(sender As Object, e As EventArgs) Handles Button1.Click
        Response.Redirect("Login.aspx")
    End Sub

    Protected Sub Button2_Click(sender As Object, e As EventArgs) Handles Button2.Click
        Dim email As String = Request.QueryString("erab")

        Using erab As SqlDataReader = DatuAtzipena.ErabiltzaileaLortu(email)
            If erab.Read() Then
                Dim erantzunaDB As String = erab("erantzuna").ToString()
                Dim pasahitza As String = erab("pasahitza").ToString()
                Dim izena As String = erab("izena").ToString()

                If erantzunaDB.Trim().ToLower() = TextBox1.Text.Trim().ToLower() Then
                    Label2.Text = "Zure pasahitza: " & pasahitza
                    Label2.ForeColor = Drawing.Color.Green

                    Try
                        Dim asuntoa As String = "Zure pasahitza"
                        Dim mezua As String = "Kaixo " & izena & ", zure pasahitza: " & pasahitza
                        DatuAtzipena.BidaliEmaila(email, asuntoa, mezua)

                        Label2.Text &= " (Emaila ondo bidali da)."
                    Catch ex As Exception
                        Label2.Text &= " (Errorea emaila bidaltzean, baina hemen duzu pasahitza)."
                        Label2.ForeColor = Drawing.Color.Orange
                    End Try
                Else
                    Label2.Text = "Erantzun okerra."
                    Label2.ForeColor = Drawing.Color.Red
                End If
            End If
        End Using
    End Sub
End Class