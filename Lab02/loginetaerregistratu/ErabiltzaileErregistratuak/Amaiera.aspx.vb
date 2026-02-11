Public Class Amaiera
    Inherits System.Web.UI.Page

    Protected Sub Page_Load(ByVal sender As Object, ByVal e As System.EventArgs) Handles Me.Load

        Dim email As String = Request.QueryString("erab")

        If Session("erab") Is Nothing Then
            Session.Clear()
            Response.Redirect("Hasiera.aspx")
            Return
        End If

        Dim emailSesion As String = Session("erab").ToString()

        If email Is Nothing OrElse email <> emailSesion Then
            Session.Clear()
            Response.Redirect("Hasiera.aspx")
            Return
        End If


    End Sub


    Protected Sub btnIrten_Click(sender As Object, e As EventArgs) Handles btnIrten.Click

        Session.Clear()
        Session.Abandon()


        Response.Cache.SetCacheability(HttpCacheability.NoCache)
        Response.Cache.SetNoStore()


        Response.Redirect("Hasiera.aspx")
    End Sub

End Class