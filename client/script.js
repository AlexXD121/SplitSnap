// SplitSnap Simple - Client-Side Implementation

class SplitSnapClient {
  constructor() {
    this.stream = null;
    this.apiBaseUrl = "http://localhost:3003/api";
    this.currentReceipt = null;
    this.participants = [];
    this.splitMethod = "equal";
    this.currentSplit = null;
    this.validatedUPI = null;
    this.userStats = {
      totalReceipts: 0,
      totalSplits: 0,
      totalAmount: 0,
      recentActivity: [],
    };

    // Theme manager is initialized automatically by theme-manager.js

    this.init();
  }

  init() {
    this.addNotificationStyles();
    this.bindEvents();
    console.log("SplitSnap Client initialized");
  }

  bindEvents() {
    // Wait for DOM to be ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () =>
        this.bindEventsInternal()
      );
    } else {
      this.bindEventsInternal();
    }
  }

  bindEventsInternal() {
    // Authentication events
    this.bindAuthEvents();

    // Main app events
    this.bindMainAppEvents();
  }

  bindAuthEvents() {
    // Auth tab switching
    document.querySelectorAll(".auth-tab").forEach((tab) => {
      tab.addEventListener("click", (e) =>
        this.switchAuthTab(e.target.dataset.tab)
      );
    });

    // Auth form submissions
    document
      .getElementById("signin-btn")
      ?.addEventListener("click", () => this.handleSignIn());
    document
      .getElementById("signup-btn")
      ?.addEventListener("click", () => this.handleSignUp());
    document
      .getElementById("anonymous-btn")
      ?.addEventListener("click", () => this.handleAnonymousSignIn());

    // Profile events
    document
      .getElementById("profile-btn")
      ?.addEventListener("click", () => this.showProfile());
    document
      .getElementById("close-profile-btn")
      ?.addEventListener("click", () => this.hideProfile());
    document
      .getElementById("signout-btn")
      ?.addEventListener("click", () => this.handleSignOut());

    // Demo mode toggle
    document
      .getElementById("demo-toggle-btn")
      ?.addEventListener("click", () => this.toggleDemoMode());
  }

  bindMainAppEvents() {
    // Main buttons
    document
      .getElementById("capture-receipt-btn")
      ?.addEventListener("click", () => this.startCamera());
    document
      .getElementById("upload-receipt-btn")
      ?.addEventListener("click", () => this.openFileUpload());

    // Camera controls
    document
      .getElementById("capture-btn")
      ?.addEventListener("click", () => this.captureImage());
    document
      .getElementById("close-camera-btn")
      ?.addEventListener("click", () => this.closeCamera());

    // Upload controls
    document
      .getElementById("process-upload-btn")
      ?.addEventListener("click", () => this.processUpload());
    document
      .getElementById("cancel-upload-btn")
      ?.addEventListener("click", () => this.cancelUpload());

    // File input
    document
      .getElementById("file-input")
      ?.addEventListener("change", (e) => this.handleFileSelect(e));

    // Action buttons
    document
      .getElementById("start-over-btn")
      ?.addEventListener("click", () => this.startOver());
    document
      .getElementById("retry-btn")
      ?.addEventListener("click", () => this.hideError());

    // Bill splitting events
    document
      .getElementById("add-person-btn")
      ?.addEventListener("click", () => this.addPerson());
    document
      .getElementById("person-name")
      ?.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.addPerson();
      });
    document
      .getElementById("calculate-split-btn")
      ?.addEventListener("click", () => this.calculateSplit());
    document
      .getElementById("share-split-btn")
      ?.addEventListener("click", () => this.shareSplit());

    // UPI payment events
    document
      .getElementById("generate-payments-btn")
      ?.addEventListener("click", () => this.showUPISection());
    document
      .getElementById("validate-upi-btn")
      ?.addEventListener("click", () => this.validateUPI());
    document
      .getElementById("upi-id-input")
      ?.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.validateUPI();
      });
    document
      .getElementById("create-payments-btn")
      ?.addEventListener("click", () => this.createPaymentLinks());

    // Method selection
    document.querySelectorAll(".method-btn").forEach((btn) => {
      btn.addEventListener("click", (e) =>
        this.selectSplitMethod(e.target.closest(".method-btn"))
      );
    });
  }

  // Camera functionality
  async startCamera() {
    try {
      console.log("Starting camera...");

      // Hide main buttons
      document.getElementById("main-buttons").classList.add("hidden");

      // Show camera section
      document.getElementById("camera-section").classList.remove("hidden");

      // Get camera stream
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: { ideal: "environment" }, // Back camera on mobile
        },
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      const video = document.getElementById("camera-video");
      video.srcObject = this.stream;

      console.log("Camera started successfully");
    } catch (error) {
      console.error("Camera error:", error);
      this.showError(
        "Camera access denied or not available. Please try uploading an image instead."
      );
      this.closeCamera();
    }
  }

  captureImage() {
    try {
      console.log("Capturing image...");

      const video = document.getElementById("camera-video");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0);

      // Convert to blob and process
      canvas.toBlob(
        (blob) => {
          if (blob) {
            console.log("Image captured successfully");
            this.closeCamera();
            this.processImage(blob, "camera");
          } else {
            this.showError("Failed to capture image. Please try again.");
          }
        },
        "image/jpeg",
        0.8
      );
    } catch (error) {
      console.error("Capture error:", error);
      this.showError("Failed to capture image. Please try again.");
    }
  }

  closeCamera() {
    try {
      // Stop camera stream
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
      }

      // Clear video source
      const video = document.getElementById("camera-video");
      video.srcObject = null;

      // Hide camera section
      document.getElementById("camera-section").classList.add("hidden");

      // Show main buttons
      document.getElementById("main-buttons").classList.remove("hidden");

      console.log("Camera closed");
    } catch (error) {
      console.error("Error closing camera:", error);
    }
  }

  // File upload functionality
  openFileUpload() {
    console.log("Opening file upload...");
    document.getElementById("file-input").click();
  }

  handleFileSelect(event) {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      this.showError("Please select a valid image file.");
      return;
    }

    console.log("File selected:", file.name);

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const previewImage = document.getElementById("preview-image");
      previewImage.src = e.target.result;

      // Hide main buttons and show preview
      document.getElementById("main-buttons").classList.add("hidden");
      document.getElementById("upload-preview").classList.remove("hidden");
    };
    reader.readAsDataURL(file);

    // Store file for processing
    this.selectedFile = file;
  }

  processUpload() {
    if (this.selectedFile) {
      console.log("Processing uploaded file...");
      document.getElementById("upload-preview").classList.add("hidden");
      this.processImage(this.selectedFile, "upload");
    }
  }

  cancelUpload() {
    console.log("Upload cancelled");

    // Clear file input
    document.getElementById("file-input").value = "";
    this.selectedFile = null;

    // Hide preview and show main buttons
    document.getElementById("upload-preview").classList.add("hidden");
    document.getElementById("main-buttons").classList.remove("hidden");
  }

  // Image processing - Enhanced version with demo mode support
  async processImage(imageBlob, source) {
    try {
      // Check if demo mode should be used
      if (window.demoService && window.demoService.isDemoMode()) {
        console.log("🎭 Using demo mode");
        this.showProcessing("Loading demo receipt...");

        // Simulate processing delay
        setTimeout(() => {
          const demoReceipt = window.demoService.getDemoReceipt();
          this.hideProcessing();

          if (demoReceipt) {
            this.showSuccess(demoReceipt);
            this.addActivity({
              icon: "🎭",
              text: `Demo receipt processed: ${demoReceipt.merchantInfo.name}`,
            });
          } else {
            this.showError("Demo receipt not available");
          }
        }, 1000);

        return;
      }

      console.log("Processing image...", { source, size: imageBlob.size });

      // Show processing overlay
      this.showProcessing("Uploading image...");

      // Create FormData
      const formData = new FormData();
      formData.append("image", imageBlob, `receipt-${Date.now()}.jpg`);
      formData.append("source", source);

      // Send to backend
      const response = await fetch(`${this.apiBaseUrl}/ocr/process`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Hide processing overlay
      this.hideProcessing();

      if (result.success) {
        this.showSuccess(result.data);

        // Update stats
        this.userStats.totalReceipts++;
        this.userStats.totalAmount += result.data.total || 0;
        this.addActivity({
          icon: "📸",
          text: `Receipt processed: ${
            result.data.merchantInfo?.name || "Unknown"
          }`,
        });

        // Check if we should auto-enable demo mode due to low confidence
        if (result.data.confidence < 0.6) {
          window.demoService &&
            window.demoService.shouldUseDemoMode(result.data.confidence);
        }
      } else {
        this.showError(result.error || "Failed to process receipt");
      }
    } catch (error) {
      console.error("Processing error:", error);
      this.hideProcessing();

      // Auto-enable demo mode on network errors
      if (error.message.includes("fetch") && window.demoService) {
        window.demoService.enableDemoMode();
        this.showNotification("Network error - Demo mode enabled", "info");
      } else {
        this.showError(
          "Failed to process image. Please check your connection and try again."
        );
      }
    }
  }

  // UI State Management
  showProcessing(message = "Processing receipt...") {
    document.getElementById("processing-text").textContent = message;
    document.getElementById("processing-overlay").classList.remove("hidden");
  }

  hideProcessing() {
    document.getElementById("processing-overlay").classList.add("hidden");
  }

  showSuccess(ocrData) {
    console.log("OCR Success:", ocrData);

    // Store receipt data
    this.currentReceipt = ocrData;

    // Debug: Log the receipt data structure for troubleshooting
    console.log("Receipt data structure:", {
      total: ocrData.total,
      totalAmount: ocrData.totalAmount,
      subtotal: ocrData.subtotal,
      allFields: Object.keys(ocrData),
    });

    // Display OCR results
    const resultsContainer = document.getElementById("ocr-results");
    resultsContainer.textContent = ""; // Clear safely
    resultsContainer.appendChild(
      this.createSafeHTML(this.formatOCRResults(ocrData))
    );

    // Show success message
    document.getElementById("success-message").classList.remove("hidden");
  }

  showError(message) {
    console.error("Error:", message);

    document.getElementById("error-text").textContent = message;
    document.getElementById("error-message").classList.remove("hidden");
  }

  hideError() {
    document.getElementById("error-message").classList.add("hidden");
    document.getElementById("main-buttons").classList.remove("hidden");
  }

  createSafeHTML(htmlString) {
    // Create a temporary div to parse HTML safely
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlString;
    return tempDiv;
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  formatOCRResults(data) {
    if (!data) return "<p>No data extracted</p>";

    let html = "";

    // Merchant info
    if (data.merchantInfo) {
      html += `
                <div class="merchant-info">
                    <h5>${this.escapeHtml(
                      data.merchantInfo.name || "Unknown Merchant"
                    )}</h5>
                    ${
                      data.merchantInfo.address
                        ? `<p>${this.escapeHtml(data.merchantInfo.address)}</p>`
                        : ""
                    }
                    ${
                      data.merchantInfo.phone
                        ? `<p>Phone: ${this.escapeHtml(
                            data.merchantInfo.phone
                          )}</p>`
                        : ""
                    }
                </div>
            `;
    }

    // Items
    if (data.items && data.items.length > 0) {
      html += "<h4>Items:</h4>";
      data.items.forEach((item) => {
        html += `
                    <div class="receipt-item">
                        <span>${this.escapeHtml(item.name)} ${
          item.quantity ? `(${item.quantity}x)` : ""
        }</span>
                        <span>₹${
                          item.price ? item.price.toFixed(2) : "0.00"
                        }</span>
                    </div>
                `;
      });
    }

    // Totals
    if (data.subtotal !== undefined) {
      html += `<div class="receipt-item"><span>Subtotal</span><span>₹${data.subtotal.toFixed(
        2
      )}</span></div>`;
    }
    if (data.tax !== undefined && data.tax > 0) {
      html += `<div class="receipt-item"><span>Tax/GST</span><span>₹${data.tax.toFixed(
        2
      )}</span></div>`;
    }
    if (data.serviceCharge !== undefined && data.serviceCharge > 0) {
      html += `<div class="receipt-item"><span>Service Charge</span><span>₹${data.serviceCharge.toFixed(
        2
      )}</span></div>`;
    }
    if (data.total !== undefined) {
      html += `<div class="receipt-item"><span><strong>Total</strong></span><span><strong>₹${data.total.toFixed(
        2
      )}</strong></span></div>`;
    }

    // OCR method used
    if (data.ocrMethod) {
      html += `<p style="margin-top: 1rem; font-size: 0.9rem; color: var(--text-light);">Processed using: ${this.escapeHtml(
        data.ocrMethod
      )}</p>`;
    }

    // Raw text (for debugging)
    if (data.rawText && data.rawText.length > 0) {
      html += `
                <details style="margin-top: 1rem;">
                    <summary style="cursor: pointer; color: var(--text-light);">Raw OCR Text</summary>
                    <pre style="white-space: pre-wrap; font-size: 0.8rem; background: var(--light-gray); padding: 1rem; border-radius: var(--radius); margin-top: 0.5rem;">${this.escapeHtml(
                      data.rawText
                    )}</pre>
                </details>
            `;
    }

    return html || "<p>No receipt data could be extracted</p>";
  }

  startOver() {
    console.log("Starting over...");

    // Reset everything
    this.closeCamera();
    this.cancelUpload();

    // Reset bill splitting state
    this.currentReceipt = null;
    this.participants = [];
    this.splitMethod = "equal";
    this.currentSplit = null;
    this.validatedUPI = null;

    // Reset UI elements
    document.getElementById("person-name").value = "";
    document.getElementById("people-list").textContent = "";
    document.getElementById("people-list").classList.remove("has-people");
    document.getElementById("item-assignment-section").classList.add("hidden");
    document.getElementById("split-results").classList.add("hidden");
    document.getElementById("upi-payment-section").classList.add("hidden");
    document.getElementById("payment-links-section").classList.add("hidden");

    // Reset UPI form
    const upiInput = document.getElementById("upi-id-input");
    upiInput.value = "";
    upiInput.classList.remove("valid", "invalid");
    document.getElementById("upi-validation-message").classList.add("hidden");
    document.getElementById("create-payments-btn").disabled = true;

    // Reset method buttons
    document
      .querySelectorAll(".method-btn")
      .forEach((btn) => btn.classList.remove("active"));
    document
      .querySelector('.method-btn[data-method="equal"]')
      .classList.add("active");

    // Hide all sections except main buttons
    document.getElementById("camera-section").classList.add("hidden");
    document.getElementById("upload-preview").classList.add("hidden");
    document.getElementById("success-message").classList.add("hidden");
    document.getElementById("error-message").classList.add("hidden");
    document.getElementById("processing-overlay").classList.add("hidden");

    // Show main buttons
    document.getElementById("main-buttons").classList.remove("hidden");

    // Clear file input
    document.getElementById("file-input").value = "";
    this.selectedFile = null;
  }

  // Bill Splitting Methods
  addPerson() {
    const nameInput = document.getElementById("person-name");
    const name = nameInput.value.trim();

    if (!name) {
      this.showNotification("Please enter a person's name", "error");
      return;
    }

    if (
      this.participants.find((p) => p.name.toLowerCase() === name.toLowerCase())
    ) {
      this.showNotification("Person already added", "error");
      return;
    }

    const person = {
      id: Date.now().toString(),
      name: name,
      assignedItems: [],
    };

    this.participants.push(person);
    this.renderParticipants();
    this.updateItemAssignments();

    nameInput.value = "";
    nameInput.focus();

    this.showNotification(`${name} added successfully`);
  }

  removePerson(personId) {
    this.participants = this.participants.filter((p) => p.id !== personId);
    this.renderParticipants();
    this.updateItemAssignments();
    this.showNotification("Person removed");
  }

  renderParticipants() {
    const peopleList = document.getElementById("people-list");

    if (this.participants.length === 0) {
      peopleList.classList.remove("has-people");
      peopleList.textContent = "";
      return;
    }

    peopleList.classList.add("has-people");
    peopleList.textContent = "";
    peopleList.appendChild(
      this.createSafeHTML(
        this.participants
          .map(
            (person) => `
            <div class="person-chip">
                <span>${this.escapeHtml(person.name)}</span>
                <button class="remove-person" onclick="window.splitSnap.removePerson('${
                  person.id
                }')">×</button>
            </div>
        `
          )
          .join("")
      )
    );
  }

  selectSplitMethod(button) {
    // Update active state
    document
      .querySelectorAll(".method-btn")
      .forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");

    // Store method
    this.splitMethod = button.dataset.method;

    // Show/hide item assignment section
    const itemSection = document.getElementById("item-assignment-section");
    if (this.splitMethod === "by_items") {
      itemSection.classList.remove("hidden");
      this.updateItemAssignments();
    } else {
      itemSection.classList.add("hidden");
    }
  }

  updateItemAssignments() {
    if (
      this.splitMethod !== "by_items" ||
      !this.currentReceipt ||
      !this.currentReceipt.items
    ) {
      return;
    }

    const itemsList = document.getElementById("items-assignment-list");
    const items = this.currentReceipt.items;

    itemsList.textContent = "";
    itemsList.appendChild(
      this.createSafeHTML(
        items
          .map(
            (item, index) => `
            <div class="item-assignment-row">
                <div class="item-info">
                    <div class="item-name">${this.escapeHtml(item.name)}</div>
                    <div class="item-price">₹${
                      item.price ? item.price.toFixed(2) : "0.00"
                    }</div>
                </div>
                <div class="item-assignee">
                    <select class="assignee-select" data-item-index="${index}">
                        <option value="">Unassigned</option>
                        ${this.participants
                          .map(
                            (person) =>
                              `<option value="${person.id}">${this.escapeHtml(
                                person.name
                              )}</option>`
                          )
                          .join("")}
                    </select>
                </div>
            </div>
        `
          )
          .join("")
      )
    );

    // Add event listeners to selects
    itemsList.querySelectorAll(".assignee-select").forEach((select) => {
      select.addEventListener("change", (e) => this.assignItem(e.target));
    });
  }

  assignItem(selectElement) {
    const itemIndex = parseInt(selectElement.dataset.itemIndex);
    const personId = selectElement.value;
    const item = this.currentReceipt.items[itemIndex];

    // Remove item from all participants
    this.participants.forEach((person) => {
      person.assignedItems = person.assignedItems.filter(
        (i) => i.index !== itemIndex
      );
    });

    // Assign to selected person
    if (personId) {
      const person = this.participants.find((p) => p.id === personId);
      if (person) {
        person.assignedItems.push({
          index: itemIndex,
          name: item.name,
          price: item.price || 0,
        });
      }
    }
  }

  async calculateSplit() {
    if (this.participants.length === 0) {
      this.showNotification("Please add at least one person", "error");
      return;
    }

    if (!this.currentReceipt) {
      this.showNotification("No receipt data available", "error");
      return;
    }

    // Always use client-side calculation for now to avoid database field mismatch issues
    this.showProcessing("Calculating split...");

    // Small delay to show processing state
    setTimeout(() => {
      this.hideProcessing();
      this.calculateSplitClientSide();
    }, 500);
  }

  calculateSplitClientSide() {
    // Try multiple fields to get the total amount
    let total = 0;

    // Check various possible field names for total
    if (
      this.currentReceipt.total &&
      typeof this.currentReceipt.total === "number"
    ) {
      total = this.currentReceipt.total;
    } else if (
      this.currentReceipt.totalAmount &&
      typeof this.currentReceipt.totalAmount === "number"
    ) {
      total = this.currentReceipt.totalAmount;
    } else if (
      this.currentReceipt.subtotal &&
      typeof this.currentReceipt.subtotal === "number"
    ) {
      total = this.currentReceipt.subtotal;
    } else {
      // Try to extract from items if available
      if (
        this.currentReceipt.items &&
        Array.isArray(this.currentReceipt.items)
      ) {
        total = this.currentReceipt.items.reduce((sum, item) => {
          const price = parseFloat(item.price) || 0;
          return sum + price;
        }, 0);
      }
    }

    console.log("Receipt data for calculation:", this.currentReceipt);
    console.log("Total amount found:", total);

    if (total === 0) {
      this.showNotification("Could not find total amount in receipt", "error");
      return;
    }

    const results = [];

    if (this.splitMethod === "equal") {
      const perPerson = total / this.participants.length;
      console.log("Per person amount:", perPerson);

      this.participants.forEach((person) => {
        results.push({
          name: person.name,
          amount: perPerson,
          items: [],
        });
      });
    } else if (this.splitMethod === "by_items") {
      const itemsTotal =
        this.currentReceipt.items?.reduce(
          (sum, item) => sum + (parseFloat(item.price) || 0),
          0
        ) || 0;
      const taxRatio = itemsTotal > 0 ? total / itemsTotal : 1;

      this.participants.forEach((person) => {
        const itemsSum = person.assignedItems.reduce(
          (sum, item) => sum + (parseFloat(item.price) || 0),
          0
        );
        const finalAmount = itemsSum * taxRatio;

        results.push({
          name: person.name,
          amount: finalAmount,
          items: person.assignedItems,
        });
      });
    }

    console.log("Calculation results:", results);

    this.displaySplitResults({
      calculations: results,
      summary: {
        totalAmount: total,
        participantCount: this.participants.length,
        currency: "INR",
      },
    });
  }

  displaySplitResults(data) {
    const resultsSection = document.getElementById("split-results");
    const breakdown = document.getElementById("split-breakdown");

    // Store current split for UPI payments
    this.currentSplit = data;

    let calculations = data.calculations || {};
    if (Array.isArray(calculations)) {
      // Convert array to object for consistent handling
      const calcObj = {};
      calculations.forEach((calc, index) => {
        calcObj[index] = calc;
      });
      calculations = calcObj;
    }

    // Create summary
    const summary = data.summary || {};
    const summaryHtml = `
            <div class="split-summary">
                <div class="summary-row">
                    <span>Total Amount:</span>
                    <span>₹${(summary.totalAmount || 0).toFixed(2)}</span>
                </div>
                <div class="summary-row">
                    <span>People:</span>
                    <span>${summary.participantCount || 0}</span>
                </div>
                <div class="summary-row">
                    <span>Currency:</span>
                    <span>${summary.currency || "INR"}</span>
                </div>
            </div>
        `;

    // Create breakdown
    const breakdownHtml = Object.values(calculations)
      .map(
        (calc) => `
            <div class="person-split">
                <div class="person-name">${calc.name}</div>
                <div class="person-amount">₹${(calc.amount || 0).toFixed(
                  2
                )}</div>
            </div>
        `
      )
      .join("");

    breakdown.textContent = "";
    breakdown.appendChild(this.createSafeHTML(summaryHtml + breakdownHtml));
    resultsSection.classList.remove("hidden");

    this.showNotification("Split calculated successfully!");
  }

  async shareSplit() {
    if (!this.currentReceipt || this.participants.length === 0) {
      this.showNotification("No split data to share", "error");
      return;
    }

    try {
      // Create shareable message
      const total = this.currentReceipt.total || 0;
      const merchantName =
        this.currentReceipt.merchantInfo?.name || "Restaurant";

      let message = `💰 Bill Split - ${merchantName}\n`;
      message += `Total: ₹${total.toFixed(2)}\n\n`;

      if (this.splitMethod === "equal") {
        const perPerson = total / this.participants.length;
        message += `Equal Split (${this.participants.length} people):\n`;
        this.participants.forEach((person) => {
          message += `• ${person.name}: ₹${perPerson.toFixed(2)}\n`;
        });
      } else {
        message += `Item-wise Split:\n`;
        this.participants.forEach((person) => {
          const itemsSum = person.assignedItems.reduce(
            (sum, item) => sum + item.price,
            0
          );
          message += `• ${person.name}: ₹${itemsSum.toFixed(2)}\n`;
        });
      }

      message += `\nSplit by SplitSnap 📱`;

      // Use Web Share API if available
      if (navigator.share) {
        await navigator.share({
          title: "Bill Split",
          text: message,
        });
        this.showNotification("Split shared successfully!");
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(message);
        this.showNotification("Split details copied to clipboard!");
      }
    } catch (error) {
      console.error("Share error:", error);
      this.showNotification("Failed to share split", "error");
    }
  }

  // UPI Payment Methods
  showUPISection() {
    if (!this.currentSplit || this.participants.length === 0) {
      this.showNotification("Please calculate split first", "error");
      return;
    }

    const upiSection = document.getElementById("upi-payment-section");
    upiSection.classList.remove("hidden");

    // Scroll to UPI section
    upiSection.scrollIntoView({ behavior: "smooth", block: "start" });

    // Focus on UPI input
    setTimeout(() => {
      document.getElementById("upi-id-input").focus();
    }, 500);
  }

  async validateUPI() {
    const upiInput = document.getElementById("upi-id-input");
    const upiId = upiInput.value.trim();
    const messageDiv = document.getElementById("upi-validation-message");
    const createBtn = document.getElementById("create-payments-btn");

    if (!upiId) {
      this.showValidationMessage("Please enter a UPI ID", "error");
      return;
    }

    try {
      this.showProcessing("Validating UPI ID...");

      const response = await fetch(`${this.apiBaseUrl}/upi/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ upiId }),
      });

      const result = await response.json();
      this.hideProcessing();

      if (result.success && result.data.isValid) {
        upiInput.classList.remove("invalid");
        upiInput.classList.add("valid");
        this.showValidationMessage("✓ Valid UPI ID", "success");
        createBtn.disabled = false;
        this.validatedUPI = upiId;
        this.showNotification("UPI ID validated successfully!");
      } else {
        upiInput.classList.remove("valid");
        upiInput.classList.add("invalid");
        this.showValidationMessage("✗ Invalid UPI ID format", "error");
        createBtn.disabled = true;
        this.validatedUPI = null;
      }
    } catch (error) {
      console.error("UPI validation error:", error);
      this.hideProcessing();
      this.showValidationMessage("✗ Validation failed", "error");
      createBtn.disabled = true;
      this.validatedUPI = null;
    }
  }

  showValidationMessage(message, type) {
    const messageDiv = document.getElementById("upi-validation-message");
    messageDiv.textContent = message;
    messageDiv.className = `validation-message ${type}`;
    messageDiv.classList.remove("hidden");
  }

  async createPaymentLinks() {
    if (!this.validatedUPI) {
      this.showNotification("Please validate UPI ID first", "error");
      return;
    }

    if (!this.currentSplit || this.participants.length === 0) {
      this.showNotification("No split data available", "error");
      return;
    }

    try {
      this.showProcessing("Creating payment links...");

      // Prepare split data for UPI service
      const splitData = {
        participants: this.participants.map((person) => ({
          id: person.id,
          name: person.name,
          amount: this.getSplitAmount(person),
        })),
        merchantName: this.currentReceipt.merchantInfo?.name || "Restaurant",
      };

      const response = await fetch(
        `${this.apiBaseUrl}/upi/generate-split-payments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            splitData,
            payerUPI: this.validatedUPI,
          }),
        }
      );

      const result = await response.json();
      this.hideProcessing();

      if (result.success) {
        this.displayPaymentLinks(result.data.payments);
        this.showNotification("Payment links created successfully!");
      } else {
        this.showNotification("Failed to create payment links", "error");
      }
    } catch (error) {
      console.error("Create payment links error:", error);
      this.hideProcessing();
      this.showNotification("Failed to create payment links", "error");
    }
  }

  getSplitAmount(person) {
    if (!this.currentSplit) return 0;

    // Get amount from current split calculation
    const calculations = this.currentSplit.calculations || {};

    if (Array.isArray(calculations)) {
      const personCalc = calculations.find((calc) => calc.name === person.name);
      return personCalc ? personCalc.amount : 0;
    } else {
      // Object format
      const personCalc = Object.values(calculations).find(
        (calc) => calc.name === person.name
      );
      return personCalc ? personCalc.amount : 0;
    }
  }

  displayPaymentLinks(payments) {
    const linksSection = document.getElementById("payment-links-section");
    const linksList = document.getElementById("payment-links-list");

    linksList.textContent = "";
    linksList.appendChild(
      this.createSafeHTML(
        payments
          .map(
            (payment) => `
            <div class="payment-link-card">
                <div class="payment-card-header">
                    <div class="participant-info">
                        <div class="participant-name">${this.escapeHtml(
                          payment.participantName
                        )}</div>
                        <div class="participant-amount">₹${payment.amount.toFixed(
                          2
                        )}</div>
                    </div>
                </div>
                
                <div class="qr-code-container">
                    <img src="${this.escapeHtml(
                      payment.qrCode
                    )}" alt="QR Code for ${this.escapeHtml(
              payment.participantName
            )}" class="qr-code" width="150" height="150">
                </div>
                
                <div class="payment-actions-row">
                    <button class="action-btn upi-btn" onclick="window.splitSnap.openUPIApp('${this.escapeHtml(
                      payment.upiLink
                    )}')">
                        <span>💳</span>
                        Pay via UPI
                    </button>
                    <button class="action-btn whatsapp-btn" onclick="window.splitSnap.shareViaWhatsApp('${this.escapeHtml(
                      payment.whatsappURL
                    )}')">
                        <span>📱</span>
                        WhatsApp
                    </button>
                    <button class="action-btn copy-btn" onclick="window.splitSnap.copyPaymentLink('${this.escapeHtml(
                      payment.upiLink
                    )}')">
                        <span>📋</span>
                        Copy Link
                    </button>
                </div>
            </div>
        `
          )
          .join("")
      )
    );

    linksSection.classList.remove("hidden");

    // Scroll to payment links
    setTimeout(() => {
      linksSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
  }

  openUPIApp(upiLink) {
    try {
      // Try to open UPI app
      window.location.href = upiLink;
      this.showNotification("Opening UPI app...");

      // Fallback message after a delay
      setTimeout(() => {
        this.showNotification(
          "If UPI app didn't open, please copy the link manually",
          "info"
        );
      }, 3000);
    } catch (error) {
      console.error("UPI app open error:", error);
      this.copyPaymentLink(upiLink);
    }
  }

  shareViaWhatsApp(whatsappURL) {
    try {
      window.open(whatsappURL, "_blank");
      this.showNotification("Opening WhatsApp...");
    } catch (error) {
      console.error("WhatsApp share error:", error);
      this.showNotification("Failed to open WhatsApp", "error");
    }
  }

  async copyPaymentLink(upiLink) {
    try {
      await navigator.clipboard.writeText(upiLink);
      this.showNotification("Payment link copied to clipboard!");
    } catch (error) {
      console.error("Copy error:", error);

      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = upiLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);

      this.showNotification("Payment link copied!");
    }
  }

  // Authentication Methods
  switchAuthTab(tab) {
    document
      .querySelectorAll(".auth-tab")
      .forEach((t) => t.classList.remove("active"));
    document.querySelector(`[data-tab="${tab}"]`).classList.add("active");

    document
      .getElementById("signin-form")
      .classList.toggle("hidden", tab !== "signin");
    document
      .getElementById("signup-form")
      .classList.toggle("hidden", tab !== "signup");
  }

  async handleSignIn() {
    const email = document.getElementById("signin-email").value.trim();
    const password = document.getElementById("signin-password").value.trim();

    if (!email || !password) {
      this.showNotification("Please fill in all fields", "error");
      return;
    }

    if (!email.includes("@")) {
      this.showNotification("Please enter a valid email address", "error");
      return;
    }

    if (password.length < 6) {
      this.showNotification("Password must be at least 6 characters", "error");
      return;
    }

    // Show loading state
    const signinBtn = document.getElementById("signin-btn");
    const originalText = signinBtn.textContent;
    signinBtn.textContent = "Signing In...";
    signinBtn.disabled = true;

    try {
      const result = await window.authService.signIn(email, password);
      if (result.success) {
        this.updateUserStats();
        this.showNotification("Welcome back!", "success");
      } else {
        this.showNotification(result.error || "Sign in failed", "error");
      }
    } catch (error) {
      console.error("Sign in error:", error);
      this.showNotification("An unexpected error occurred", "error");
    } finally {
      // Restore button state
      signinBtn.textContent = originalText;
      signinBtn.disabled = false;
    }
  }

  async handleSignUp() {
    const name = document.getElementById("signup-name").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value.trim();

    if (!name || !email || !password) {
      this.showNotification("Please fill in all fields", "error");
      return;
    }

    if (name.length < 2) {
      this.showNotification("Name must be at least 2 characters", "error");
      return;
    }

    if (!email.includes("@")) {
      this.showNotification("Please enter a valid email address", "error");
      return;
    }

    if (password.length < 6) {
      this.showNotification("Password must be at least 6 characters", "error");
      return;
    }

    // Show loading state
    const signupBtn = document.getElementById("signup-btn");
    const originalText = signupBtn.textContent;
    signupBtn.textContent = "Creating Account...";
    signupBtn.disabled = true;

    try {
      const result = await window.authService.signUp(email, password, name);
      if (result.success) {
        this.updateUserStats();
        this.showNotification("Account created successfully!", "success");
      } else {
        this.showNotification(result.error || "Sign up failed", "error");
      }
    } catch (error) {
      console.error("Sign up error:", error);
      this.showNotification("An unexpected error occurred", "error");
    } finally {
      // Restore button state
      signupBtn.textContent = originalText;
      signupBtn.disabled = false;
    }
  }

  async handleAnonymousSignIn() {
    // Show loading state
    const anonymousBtn = document.getElementById("anonymous-btn");
    const originalText = anonymousBtn.textContent;
    anonymousBtn.textContent = "Signing In...";
    anonymousBtn.disabled = true;

    try {
      const result = await window.authService.signInAnonymously();
      if (result.success) {
        this.updateUserStats();
        this.showNotification(
          "Welcome! You can use the app anonymously",
          "success"
        );
      } else {
        this.showNotification(
          result.error || "Anonymous sign in failed",
          "error"
        );
      }
    } catch (error) {
      console.error("Anonymous sign in error:", error);
      this.showNotification("An unexpected error occurred", "error");
    } finally {
      // Restore button state
      anonymousBtn.textContent = originalText;
      anonymousBtn.disabled = false;
    }
  }

  async handleSignOut() {
    const result = await window.authService.signOut();
    if (result.success) {
      this.resetAppState();
    }
  }

  // Profile Methods
  showProfile() {
    const user = window.authService.getCurrentUser();
    if (!user) return;

    // Update profile info
    document.getElementById("profile-name").textContent = user.name || "User";
    document.getElementById("profile-email").textContent =
      user.email || "Anonymous";
    document.getElementById("profile-date").textContent = new Date(
      user.createdAt
    ).toLocaleDateString();

    // Update stats
    document.getElementById("total-receipts").textContent =
      this.userStats.totalReceipts;
    document.getElementById("total-splits").textContent =
      this.userStats.totalSplits;
    document.getElementById(
      "total-amount"
    ).textContent = `₹${this.userStats.totalAmount.toFixed(0)}`;

    // Update recent activity
    this.updateRecentActivity();

    document.getElementById("profile-modal").classList.remove("hidden");
  }

  hideProfile() {
    document.getElementById("profile-modal").classList.add("hidden");
  }

  updateUserStats() {
    // Load stats from localStorage
    const savedStats = localStorage.getItem("splitsnap_stats");
    if (savedStats) {
      this.userStats = { ...this.userStats, ...JSON.parse(savedStats) };
    }
  }

  saveUserStats() {
    localStorage.setItem("splitsnap_stats", JSON.stringify(this.userStats));
  }

  addActivity(activity) {
    this.userStats.recentActivity.unshift({
      ...activity,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 10 activities
    this.userStats.recentActivity = this.userStats.recentActivity.slice(0, 10);
    this.saveUserStats();
  }

  updateRecentActivity() {
    const activityList = document.getElementById("recent-activity");

    if (this.userStats.recentActivity.length === 0) {
      activityList.textContent = "";
      activityList.appendChild(
        this.createSafeHTML(`
                <div class="activity-item">
                    <span class="activity-icon">👋</span>
                    <span class="activity-text">Welcome to SplitSnap!</span>
                    <span class="activity-time">Just now</span>
                </div>
            `)
      );
      return;
    }

    activityList.textContent = "";
    activityList.appendChild(
      this.createSafeHTML(
        this.userStats.recentActivity
          .map(
            (activity) => `
            <div class="activity-item">
                <span class="activity-icon">${this.escapeHtml(
                  activity.icon
                )}</span>
                <span class="activity-text">${this.escapeHtml(
                  activity.text
                )}</span>
                <span class="activity-time">${this.escapeHtml(
                  this.formatTimeAgo(activity.timestamp)
                )}</span>
            </div>
        `
          )
          .join("")
      )
    );
  }

  formatTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  // Demo Mode Methods
  toggleDemoMode() {
    const isEnabled = window.demoService.toggleDemoMode();
    const btn = document.getElementById("demo-toggle-btn");

    if (isEnabled) {
      btn.classList.add("active");
      btn.textContent = "";
      btn.appendChild(
        this.createSafeHTML('<span class="btn-icon">🎭</span>Demo ON')
      );
    } else {
      btn.classList.remove("active");
      btn.textContent = "";
      btn.appendChild(
        this.createSafeHTML('<span class="btn-icon">📷</span>Demo OFF')
      );
    }
  }

  resetAppState() {
    // Reset all app state
    this.currentReceipt = null;
    this.participants = [];
    this.splitMethod = "equal";
    this.currentSplit = null;
    this.validatedUPI = null;
    this.userStats = {
      totalReceipts: 0,
      totalSplits: 0,
      totalAmount: 0,
      recentActivity: [],
    };

    // Reset UI
    this.startOver();
  }

  // Enhanced displaySplitResults to update stats
  displaySplitResults(data) {
    const resultsSection = document.getElementById("split-results");
    const breakdown = document.getElementById("split-breakdown");

    // Store current split for UPI payments
    this.currentSplit = data;

    let calculations = data.calculations || {};
    if (Array.isArray(calculations)) {
      // Convert array to object for consistent handling
      const calcObj = {};
      calculations.forEach((calc, index) => {
        calcObj[index] = calc;
      });
      calculations = calcObj;
    }

    // Create summary
    const summary = data.summary || {};
    const summaryHtml = `
            <div class="split-summary">
                <div class="summary-row">
                    <span>Total Amount:</span>
                    <span>₹${(summary.totalAmount || 0).toFixed(2)}</span>
                </div>
                <div class="summary-row">
                    <span>People:</span>
                    <span>${summary.participantCount || 0}</span>
                </div>
                <div class="summary-row">
                    <span>Currency:</span>
                    <span>${summary.currency || "INR"}</span>
                </div>
            </div>
        `;

    // Create breakdown
    const breakdownHtml = Object.values(calculations)
      .map(
        (calc) => `
            <div class="person-split">
                <div class="person-name">${calc.name}</div>
                <div class="person-amount">₹${(calc.amount || 0).toFixed(
                  2
                )}</div>
            </div>
        `
      )
      .join("");

    breakdown.textContent = "";
    breakdown.appendChild(this.createSafeHTML(summaryHtml + breakdownHtml));
    resultsSection.classList.remove("hidden");

    // Update stats
    this.userStats.totalSplits++;
    this.addActivity({
      icon: "💰",
      text: `Bill split among ${summary.participantCount || 0} people`,
    });

    this.showNotification("Split calculated successfully!");
  }

  // Notification System
  showNotification(message, type = "success") {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${
              type === "success"
                ? "var(--success)"
                : type === "error"
                ? "var(--error)"
                : "var(--info)"
            };
            color: white;
            padding: 1rem 1.5rem;
            border-radius: var(--radius);
            box-shadow: var(--shadow-lg);
            z-index: 1001;
            animation: slideInRight 0.3s ease-out;
            max-width: 350px;
            font-weight: 500;
            border: 1px solid ${
              type === "success"
                ? "var(--success)"
                : type === "error"
                ? "var(--error)"
                : "var(--info)"
            };
        `;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      notification.style.animation = "slideOutRight 0.3s ease-out";
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }, 4000);

    // Add click to dismiss
    notification.addEventListener("click", () => {
      notification.style.animation = "slideOutRight 0.3s ease-out";
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    });
  }

  // Add notification animations to CSS
  addNotificationStyles() {
    if (!document.getElementById("notification-styles")) {
      const style = document.createElement("style");
      style.id = "notification-styles";
      style.textContent = `
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                
                @keyframes slideOutRight {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
      document.head.appendChild(style);
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.splitSnap = new SplitSnapClient();
});
