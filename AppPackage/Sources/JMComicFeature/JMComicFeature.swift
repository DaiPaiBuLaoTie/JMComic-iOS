import Capacitor

/// Keeps the native dependencies in the local package; the app target only hosts the web interface.
public enum JMComicFeature {
    public static let bundledInterfaceOnly = true
}
