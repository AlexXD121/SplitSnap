// Authentication Service for SplitSnap

class AuthService {
  constructor() {
    // Get Supabase config from environment or use demo mode
    this.supabaseUrl = window.SUPABASE_URL || null;
    this.supabaseKey = window.SUPABASE_ANON_KEY || null;
    this.currentUser = null;
    this.demoMode = !this.supabaseUrl || !this.supabaseKey;
    this.init();
  }

  init() {
    // Check if user is already logged in
    this.checkAuthState();
  }

  async checkAuthState() {
    const user = localStorage.getItem("splitsnap_user");
    if (user) {
      this.currentUser = JSON.parse(user);
      this.showMainApp();
    } else {
      this.showAuthPage();
    }
  }

  showAuthPage() {
    document.getElementById("auth-container").classList.remove("hidden");
    document.getElementById("main-app").classList.add("hidden");
  }

  showMainApp() {
    document.getElementById("auth-container").classList.add("hidden");
    document.getElementById("main-app").classList.remove("hidden");

    // Update UI with user info
    if (this.currentUser) {
      document.getElementById("user-name").textContent =
        this.currentUser.name || "User";
      document.getElementById("user-email").textContent =
        this.currentUser.email || "Anonymous";
    }
  }

  async signInAnonymously() {
    try {
      const anonymousUser = {
        id: "anon_" + Date.now(),
        name: "Anonymous User",
        email: null,
        isAnonymous: true,
        createdAt: new Date().toISOString(),
      };

      this.currentUser = anonymousUser;
      localStorage.setItem("splitsnap_user", JSON.stringify(anonymousUser));

      this.showMainApp();
      this.showNotification("Signed in anonymously!");

      return { success: true, user: anonymousUser };
    } catch (error) {
      console.error("Anonymous sign in error:", error);
      this.showNotification("Failed to sign in anonymously", "error");
      return { success: false, error: error.message };
    }
  }

  async signUp(email, password, name) {
    try {
      if (this.demoMode) {
        // Demo mode - simulate successful signup
        const user = {
          id: "demo_user_" + Date.now(),
          name: name,
          email: email,
          isAnonymous: false,
          createdAt: new Date().toISOString(),
          isDemoUser: true,
        };

        this.currentUser = user;
        localStorage.setItem("splitsnap_user", JSON.stringify(user));

        this.showMainApp();
        this.showNotification("Demo account created successfully!");

        return { success: true, user };
      }

      // TODO: Implement actual Supabase authentication
      // const { data, error } = await supabase.auth.signUp({ email, password });

      // For now, show error since Supabase is not configured
      this.showNotification(
        "Supabase not configured. Please use demo mode.",
        "error"
      );
      return { success: false, error: "Supabase not configured" };
    } catch (error) {
      console.error("Sign up error:", error);
      this.showNotification("Failed to create account", "error");
      return { success: false, error: error.message };
    }
  }

  async signIn(email, password) {
    try {
      if (this.demoMode) {
        // Demo mode - simulate successful signin
        const user = {
          id: "demo_user_" + Date.now(),
          name: email.split("@")[0],
          email: email,
          isAnonymous: false,
          createdAt: new Date().toISOString(),
          isDemoUser: true,
        };

        this.currentUser = user;
        localStorage.setItem("splitsnap_user", JSON.stringify(user));

        this.showMainApp();
        this.showNotification("Demo sign in successful!");

        return { success: true, user };
      }

      // TODO: Implement actual Supabase authentication
      // const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      // For now, show error since Supabase is not configured
      this.showNotification(
        "Supabase not configured. Please use demo mode.",
        "error"
      );
      return { success: false, error: "Supabase not configured" };
    } catch (error) {
      console.error("Sign in error:", error);
      this.showNotification("Failed to sign in", "error");
      return { success: false, error: error.message };
    }
  }

  async signOut() {
    try {
      this.currentUser = null;
      localStorage.removeItem("splitsnap_user");

      this.showAuthPage();
      this.showNotification("Signed out successfully!");

      return { success: true };
    } catch (error) {
      console.error("Sign out error:", error);
      this.showNotification("Failed to sign out", "error");
      return { success: false, error: error.message };
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return this.currentUser !== null;
  }

  showNotification(message, type = "success") {
    const notification = document.createElement("div");
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === "success" ? "#4CAF50" : "#F44336"};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1001;
            animation: slideIn 0.3s ease-out;
            max-width: 300px;
        `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Initialize auth service
window.authService = new AuthService();
