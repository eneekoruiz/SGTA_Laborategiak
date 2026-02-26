Public Class ErroreaPasahitzaAldatzean
    Inherits ApplicationException
    Public Sub New(Optional ByVal Mezua As String = "Errorea: Ezin izan da erabiltzailearen pasahitza aldatu")
        MyBase.New(Mezua)
    End Sub
End Class
