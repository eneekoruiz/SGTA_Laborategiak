Imports loginetaerregistratu

Public Class Egiaztatu
    Inherits System.Web.UI.Page

    Protected Sub Page_Load(ByVal sender As Object, ByVal e As System.EventArgs) Handles Me.Load
        DatuAtzipena.ErabiltzaileaEgiaztatu(Request.QueryString("erab"))
    End Sub

    Protected Sub Button1_Click(sender As Object, e As EventArgs) Handles Button1.Click
        Response.Redirect("Login.aspx")

    End Sub
End Class