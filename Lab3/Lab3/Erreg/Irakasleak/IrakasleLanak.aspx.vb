Public Class IrakasleLanak
    Inherits System.Web.UI.Page

    Protected Sub Page_Load(ByVal sender As Object, ByVal e As System.EventArgs) Handles Me.Load
        Dim email As String = Request.QueryString("erab")
        If Session("erab") Is Nothing Then
            Session.Abandon()
            Response.Redirect("~/Hasiera.aspx")
        End If

        Dim emailSesion As String = Session("erab").ToString()

        If email Is Nothing OrElse email <> emailSesion Then
            Session.Abandon()
            Response.Redirect("~/Hasiera.aspx")
            Return
        End If
    End Sub

    Protected Sub Button1_Click(sender As Object, e As EventArgs) Handles Button1.Click
        Response.Redirect("~/Erreg/Irakasleak/LanGenerikoaGehitu.aspx?erab=" & Request.QueryString("erab"))
    End Sub

    Protected Sub LinkButton1_Click(sender As Object, e As EventArgs) Handles LinkButton1.Click
        Session.Abandon()
        Response.Redirect("~/Hasiera.aspx")
    End Sub
End Class