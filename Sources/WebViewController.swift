import UIKit
import WebKit

/// Finestra a tutto schermo su instagram.com con lo script "noreels.js" già attivo.
final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {

    // MARK: - Impostazioni

    /// Pagina di partenza (lo script la manda subito ai messaggi).
    private let homeURL = URL(string: "https://www.instagram.com/")!

    /// Se torni nell'app dopo almeno questi minuti, si riparte da capo (pausa compresa).
    private let minutiPerRipartire: TimeInterval = 5

    /// Domini che restano dentro l'app. Tutto il resto si apre in Safari.
    private let dominiInterni = [
        "instagram.com", "cdninstagram.com",
        "facebook.com", "fbcdn.net", "fbsbx.com",
    ]

    // MARK: - Stato

    private var webView: WKWebView!
    private var andatoViaDa: Date?

    // MARK: - Ciclo di vita

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()          // login e dati restano salvati
        config.allowsInlineMediaPlayback = true
        // Si presenta come Safari, così Instagram mostra il sito mobile normale
        config.applicationNameForUserAgent = "Version/18.0 Mobile/15E148 Safari/604.1"

        if let url = Bundle.main.url(forResource: "noreels", withExtension: "js"),
           let codice = try? String(contentsOf: url, encoding: .utf8) {
            let script = WKUserScript(
                source: codice,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
            config.userContentController.addUserScript(script)
        }

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true   // swipe dal bordo = indietro
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        webView.scrollView.backgroundColor = .systemBackground
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)

        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])

        // Tira giù per ricaricare
        let refresh = UIRefreshControl()
        refresh.addTarget(self, action: #selector(ricarica(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refresh

        NotificationCenter.default.addObserver(
            self, selector: #selector(inBackground),
            name: UIApplication.didEnterBackgroundNotification, object: nil
        )
        NotificationCenter.default.addObserver(
            self, selector: #selector(inPrimoPiano),
            name: UIApplication.willEnterForegroundNotification, object: nil
        )

        webView.load(URLRequest(url: homeURL))
    }

    // Così lo scuotimento del telefono arriva anche se non hai toccato nessun campo di testo
    override var canBecomeFirstResponder: Bool { true }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        becomeFirstResponder()
    }

    // MARK: - Azioni

    /// Apre la schermata Impostazioni dello script (pausa sì/no).
    func apriImpostazioni() {
        webView?.evaluateJavaScript(
            "window.__calmaImpostazioni && window.__calmaImpostazioni()",
            completionHandler: nil
        )
    }

    @objc private func ricarica(_ sender: UIRefreshControl) {
        webView.reload()
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) { sender.endRefreshing() }
    }

    @objc private func inBackground() {
        andatoViaDa = Date()
    }

    @objc private func inPrimoPiano() {
        if let data = andatoViaDa, Date().timeIntervalSince(data) > minutiPerRipartire * 60 {
            webView.load(URLRequest(url: homeURL))
        }
        andatoViaDa = nil
    }

    // MARK: - Regole di navigazione

    private func isInterno(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased() else { return true }
        return dominiInterni.contains { host == $0 || host.hasSuffix("." + $0) }
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction
    ) async -> WKNavigationActionPolicy {
        guard let url = navigationAction.request.url else { return .allow }
        let schema = url.scheme?.lowercased() ?? ""

        // Contenuti interni della pagina
        if ["about", "blob", "data", "javascript"].contains(schema) { return .allow }

        // Iframe e frame secondari: lasciali caricare
        if let frame = navigationAction.targetFrame, !frame.isMainFrame { return .allow }

        // Instagram resta qui dentro
        if (schema == "http" || schema == "https") && isInterno(url) { return .allow }

        // Mai aprire l'app ufficiale
        if schema == "instagram" { return .cancel }

        // Link esterni, mail, telefono: fuori dall'app
        _ = await UIApplication.shared.open(url)
        return .cancel
    }

    // Link che vogliono aprire una nuova finestra (target="_blank")
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url {
            if isInterno(url) {
                webView.load(navigationAction.request)
            } else if url.scheme?.lowercased() != "instagram" {
                UIApplication.shared.open(url)
            }
        }
        return nil
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.scrollView.refreshControl?.endRefreshing()
    }

    // Se il motore della pagina si chiude (memoria piena ecc.), ricarica
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }

    // MARK: - Avvisi JavaScript (alert / confirm)

    func webView(
        _ webView: WKWebView,
        runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo
    ) async {
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in cont.resume() })
            present(alert, animated: true)
        }
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo
    ) async -> Bool {
        await withCheckedContinuation { (cont: CheckedContinuation<Bool, Never>) in
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Annulla", style: .cancel) { _ in cont.resume(returning: false) })
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in cont.resume(returning: true) })
            present(alert, animated: true)
        }
    }
}
