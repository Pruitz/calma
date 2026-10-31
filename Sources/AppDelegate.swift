import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        // Scuotere il telefono apre le impostazioni di Calma, non "Annulla digitazione"
        application.applicationSupportsShakeToEdit = false
        return true
    }

    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: nil, sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let controller = WebViewController()
        let window = CalmaWindow(windowScene: windowScene)
        window.allaScossa = { [weak controller] in controller?.apriImpostazioni() }
        window.rootViewController = controller
        window.makeKeyAndVisible()
        self.window = window
    }
}

/// Finestra che riconosce quando scuoti il telefono.
final class CalmaWindow: UIWindow {
    var allaScossa: (() -> Void)?

    override func motionEnded(_ motion: UIEvent.EventSubtype, with event: UIEvent?) {
        if motion == .motionShake { allaScossa?() }
        super.motionEnded(motion, with: event)
    }
}
