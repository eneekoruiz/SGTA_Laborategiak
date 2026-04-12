<%@ Page Language="vb" AutoEventWireup="false" CodeBehind="Amaiera.aspx.vb" Inherits="ErabiltzaileErregistratuak.Amaiera" %>

<!DOCTYPE html>

<html xmlns="http://www.w3.org/1999/xhtml">
<head runat="server">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>Amaiera</title>
    <style>
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden; 
            background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
            background-size: 400% 400%;
            animation: gradientBG 15s ease infinite;
        }

        @keyframes gradientBG {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }

        
        .end-card {
            background-color: rgba(255, 255, 255, 0.7); 
            backdrop-filter: blur(30px);
            -webkit-backdrop-filter: blur(30px);
            padding: 60px 50px;
            width: 100%;
            max-width: 420px;
            border-radius: 32px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
            border: 1px solid rgba(255, 255, 255, 0.6);
            text-align: center;
            position: relative;
            z-index: 10; 
            
            
            opacity: 0;
            transform: scale(0.8) translateY(20px);
            animation: heroEntrance 1s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        @keyframes heroEntrance {
            to { opacity: 1; transform: scale(1) translateY(0); }
        }

        
        .end-card h1 {
            font-size: 32px;
            font-weight: 800;
            margin: 0 0 10px 0;
            color: #1d1d1f;
            letter-spacing: -1px;
        }

        .end-card p {
            font-size: 20px;
            color: #515154;
            font-weight: 500;
            margin: 0 0 30px 0;
        }

        .smiley {
            font-size: 80px;
            display: inline-block;
            margin-bottom: 30px;
            animation: float 3s ease-in-out infinite;
            filter: drop-shadow(0 10px 10px rgba(0,0,0,0.1));
        }

        @keyframes float {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-15px) rotate(5deg); }
        }

       
        .btn-exit {
            background-color: #1d1d1f; 
            color: white;
            font-size: 17px;
            font-weight: 600;
            padding: 16px 32px;
            border: none;
            border-radius: 99px;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 10px 20px rgba(0,0,0,0.1);
            width: 100%;
        }

        .btn-exit:hover {
            transform: scale(1.05);
            background-color: #000;
            box-shadow: 0 15px 30px rgba(0,0,0,0.2);
        }

        
        #confetti-canvas {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1; 
            pointer-events: none;
        }
    </style>
</head>
<body>
    <canvas id="confetti-canvas"></canvas>

    <form id="form1" runat="server">
        <div class="end-card">
            <h1>AMAIERARA IRITSI ZARA!!!!</h1>
            <p>MILA ESKER ZURE DENBORAGATIK</p>
            
            <div class="smiley">🎉</div> <asp:Button ID="btnIrten" runat="server" Text="Saioa Itxi eta Hasierara Joan" CssClass="btn-exit" />
        </div>
    </form>

    <script>
        var confetti = { maxCount: 150, speed: 2, frameInterval: 15, alpha: 1, gradient: !1, start: null, stop: null, toggle: null, pause: null, resume: null, togglePause: null, remove: null, isPaused: null, isRunning: null }; !function () { confetti.start = s, confetti.stop = w, confetti.toggle = function () { e ? w() : s() }, confetti.pause = u, confetti.resume = m, confetti.togglePause = function () { i ? m() : u() }, confetti.isPaused = function () { return i }, confetti.remove = function () { stop(), i = !1, a = [] }, confetti.isRunning = function () { return e }; var t = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame, n = ["rgba(30,144,255,", "rgba(107,142,35,", "rgba(255,215,0,", "rgba(255,192,203,", "rgba(106,90,205,", "rgba(173,216,230,", "rgba(238,130,238,", "rgba(152,251,152,", "rgba(70,130,180,", "rgba(244,164,96,", "rgba(210,105,30,", "rgba(220,20,60,"], e = !1, i = !1, o = Date.now(), a = [], r = 0, l = null; function d(t, e, i) { return t.color = n[Math.random() * n.length | 0] + (confetti.alpha + ")"), t.color2 = n[Math.random() * n.length | 0] + (confetti.alpha + ")"), t.x = Math.random() * e, t.y = Math.random() * i - i, t.diameter = 10 * Math.random() + 5, t.tilt = 10 * Math.random() - 10, t.tiltAngleIncrement = .07 * Math.random() + .05, t.tiltAngle = Math.random() * Math.PI, t } function u() { i = !0 } function m() { i = !1, c() } function c() { if (!i) if (0 === a.length) l.clearRect(0, 0, window.innerWidth, window.innerHeight), null; else { var n = Date.now(), u = n - o; (!t || u > confetti.frameInterval) && (l.clearRect(0, 0, window.innerWidth, window.innerHeight), function () { var t, n = window.innerWidth, i = window.innerHeight; r += .01; for (var o = 0; o < a.length; o++)t = a[o], !e && t.y < -15 ? t.y = i + 100 : (t.tiltAngle += t.tiltAngleIncrement, t.x += Math.sin(r) - .5, t.y += .5 * (Math.cos(r) + t.diameter + confetti.speed), t.tilt = 15 * Math.sin(t.tiltAngle)), (t.x > n + 20 || t.x < -20 || t.y > i) && (e && a.length <= confetti.maxCount ? d(t, n, i) : (a.splice(o, 1), o--)) }(), function (t) { for (var n = 0; n < a.length; n++) { var e = a[n]; t.beginPath(), t.lineWidth = e.diameter, t.strokeStyle = e.color, t.moveTo(e.x + e.tilt + e.diameter / 2, e.y), t.lineTo(e.x + e.tilt, e.y + e.diameter + e.tilt), t.stroke() } }(l), o = n - u % confetti.frameInterval), requestAnimationFrame(c) } } function s(t, n, o) { var r = window.innerWidth, u = window.innerHeight; window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function (t) { return window.setTimeout(t, 1000 / 60) }, l = document.getElementById("confetti-canvas").getContext("2d"), l.canvas.width = r, l.canvas.height = u, l.canvas.style.display = "block", a = [], e = !0, i = !1, function (t) { for (var n = 0; n < t; n++)a.push(d({ dir: Math.random() * Math.PI, radius: 0, speed: Math.random() * confetti.speed }, r, u)) }(confetti.maxCount), c() } function w() { e = !1 } }();
        
        
        confetti.start();
    </script>
</body>
</html>