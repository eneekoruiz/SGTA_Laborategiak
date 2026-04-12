Public Class ErroreaKonexioaIxtean
    Inherits ApplicationException
    Public Sub New(Optional ByVal Mezua As String = "Errorea: Ezin izan da konexioa itxi")
        MyBase.New(Mezua)
    End Sub
End Class
