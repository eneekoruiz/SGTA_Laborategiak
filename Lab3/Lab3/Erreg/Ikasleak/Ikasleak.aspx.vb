Public Class Ikasleak
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

        HyperLink1.NavigateUrl = "~/Erreg/Ikasleak/IkasleLanGenerikoak.aspx?erab=" & Request.QueryString("erab")
        HyperLink4.NavigateUrl = "~/Erreg/PasahitzaAldatu.aspx?erab=" & Request.QueryString("erab")



    End Sub

End Class