Imports System.Data.SqlClient
Imports System.Net
Imports loginetaerregistratu

Public Class PasahitzaBerreskkuratu
    Inherits System.Web.UI.Page
    Public erab As SqlDataReader
    Protected Sub Page_Load(ByVal sender As Object, ByVal e As System.EventArgs) Handles Me.Load
        Dim email As String = Request.QueryString("erab")
        erab = DatuAtzipena.ErabiltzaileaLortu(email)
        If erab.Read() Then
            Dim galderaDB As String = erab("galderaEzkutua").ToString()
            Label1.Text = galderaDB
        Else
            Label2.Text = "Erabiltzailea ez da existitzen."
        End If


    End Sub

    Protected Sub Button1_Click(sender As Object, e As EventArgs) Handles Button1.Click
        Response.Redirect("Login.aspx")
    End Sub

    Protected Sub Button2_Click(sender As Object, e As EventArgs) Handles Button2.Click
        Dim erantzunaDB As String = erab("erantzuna").ToString()
        Dim email As String = Request.QueryString("erab")

        If erantzunaDB = TextBox1.Text Then
            Label2.Text = "Pasahitza: " & erab("pasahitza").ToString()
            Dim asuntoa As String = "Zure pasahitza"
            Dim mezua As String = "Kaixo " & erab("izena").ToString() & ", zure pasahitza: " & erab("pasahitza").ToString()
            DatuAtzipena.BidaliEmaila(email, asuntoa, mezua)
        Else
            Label2.Text = "Erantzun okerra."
        End If

    End Sub
End Class