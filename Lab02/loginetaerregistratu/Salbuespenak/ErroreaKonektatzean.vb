Public Class ErroreaKonektatzean
    Inherits ApplicationException
    Public Sub New(Optional ByVal Mezua As String = "Errorea: Ezin izan da datu-basearekiko konexioa ireki")
        MyBase.New(Mezua)
    End Sub
End Class
