Public Class ErroreaEgiaztatzean
    Inherits ApplicationException
    Public Sub New(Optional ByVal Mezua As String = "Errorea: Ezin izan da erabiltzailea egiaztatu")
        MyBase.New(Mezua)
    End Sub
End Class
