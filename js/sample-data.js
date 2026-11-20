/* ==========================================================
   FarNaz Tech – STAGE 1 PREVIEW DATA
   ----------------------------------------------------------
   This file exists only so the homepage UI can be seen and
   tested before Firebase is connected. In Stage 3 every
   collection below is replaced by live Firestore reads and
   this file is deleted. Nothing here is a production database.
   ========================================================== */
window.FT = {
  currency: "৳",

  settings: {
    name: "FarNaz Tech",
    phone: "+880 1XXX-XXXXXX",
    email: "support@farnaztech.com",
    address: "Dhaka, Bangladesh",
    deliveryCharge: 80
  },

  categories: [
    { id: "home-electronics", name: "Home Electronics", icon: "tv" },
    { id: "laptop",           name: "Laptop",           icon: "laptop" },
    { id: "desktop-pc",       name: "Desktop PC",       icon: "monitor" },
    { id: "battery",          name: "Battery",          icon: "battery-charging" },
    { id: "smart-watch",      name: "Smart Watch",      icon: "watch" },
    { id: "smartphone",       name: "Smartphone",       icon: "smartphone" },
    { id: "accessories",      name: "Accessories",      icon: "headphones" },
    { id: "gaming",           name: "Gaming",           icon: "gamepad-2" },
    { id: "networking",       name: "Networking",       icon: "router" },
    { id: "other-gadgets",    name: "Other Gadgets",    icon: "plug-zap" }
  ],

  brands: [
    { id: "dell", name: "Dell" }, { id: "hp", name: "HP" },
    { id: "asus", name: "ASUS" }, { id: "lenovo", name: "Lenovo" },
    { id: "acer", name: "Acer" }, { id: "apple", name: "Apple" },
    { id: "samsung", name: "Samsung" }, { id: "xiaomi", name: "Xiaomi" },
    { id: "anker", name: "Anker" }, { id: "logitech", name: "Logitech" },
    { id: "sony", name: "Sony" }, { id: "baseus", name: "Baseus" }
  ],

  banners: [
    {
      badge: "New season deals", icon: "laptop",
      title: "Power up with <em>premium laptops</em>",
      text: "Top-performing laptops from Dell, HP, ASUS and Lenovo with official warranty.",
      cta: "Shop laptops", link: "products.html?category=laptop",
      chip1: "Official warranty", chip2: "EMI available"
    },
