const KEY = ""; //API key
const DOMAIN = ""; //domain name
const EXT = "/wp-json/wc/v3";
let initialQtysInCart;

var observer = new MutationObserver(async function (mutations) {
  let runTimes = 0;
  for (let i = 0; i < mutations.length; i++) {
    if (mutations[i].type === "attributes") {
      if (runTimes === 0) {
        runTimes = 1;
        executeViewItem();
      }
    }
  }
});

window.onclick = async function (e) {
  let el = e.srcElement;
  let classname = "";

  if (el) {
    classname = el.className;
  }

  //Select Item
  if (el && el.closest(".ga-wc-product") !== null) {
    let parentEl = el.closest(".ga-wc-product");
    let pID = parentEl.getAttribute("product-id");
    let pIDs = [];
    pIDs.push(pID);
    let operation = "select_item";
    let variations = [-1];
    let variationPrices = [-1];
    let quantities = [1];
    let dlContent = await getDLReadyContent(
      pIDs,
      operation,
      variations,
      variationPrices,
      quantities
    );
    pushToDataLayer(dlContent);
  }

  //Add to Cart
  if (classname !== null && classname.includes("add_to_cart_button")) {
    let pID = el.getAttribute("value");
    if (!pID) {
      pID = el.dataset.product_id;
    }
    let pIDs = [];
    pIDs.push(pID);
    operation = "add_to_cart";
    let variations = [];
    let variationPrices = [];
    let quantity = document.querySelector(".qty").value;
    let quantities = [quantity];
    if (document.querySelector(".variation_id")) {
      variations.push(
        document.querySelector(".variation_id").getAttribute("value")
      );
      variationPrices.push(
        document.querySelector(
          ".woocommerce-variation-price>.price>.woocommerce-Price-amount"
        ).dataset.price
      );
    } else {
      variations.push(-1);
      variationPrices.push(-1);
    }
    let dlContent = await getDLReadyContent(
      pIDs,
      operation,
      variations,
      variationPrices,
      quantities
    );
    pushToDataLayer(dlContent);
  }

  //Remove from cart
  if (classname.includes("ga-wc-remove")) {
    let pIDs = [];
    let variations = [];
    let variationPrices = [];
    let quantities = [];

    if (el.dataset.variation_id !== el.dataset.product_id) {
      variations.push(el.dataset.variation_id);
      variationPrices.push(el.dataset.price);
    } else {
      variations.push(-1);
      variationPrices.push(-1);
    }
    pIDs.push(el.dataset.product_id);
    quantities.push(el.dataset.quantity);
    operation = "remove_from_cart";
    let dlContent = await getDLReadyContent(
      pIDs,
      operation,
      variations,
      variationPrices,
      quantities
    );
    pushToDataLayer(dlContent);
  }

  //Update Cart
  if (classname.includes("ga-wc-update-cart")) {
    updateCart();
  }
};

window.onload = async function (e) {
  var cartSummary = document.getElementById("site-header-cart");
  cartSummary.addEventListener("mouseenter", dataLayerOperation);

  //Save Cart Quantity
  if (window.location.pathname === "/cart/") {
    setCartQuantities();
  }

  let variationEl = document.querySelector(".variation_id");
  if (variationEl) {
    observer.observe(variationEl, { attributes: true });
  }

  //View Item
  if (window.location.pathname.includes("/product/")) {
    executeViewItem();
  }

  //View Item List
  let els = document.querySelectorAll(".ga-wc-product");
  let pIDs = [];
  let variations = [];
  let variationPrices = [];
  let quantities = [];

  if (els.length > 0) {
    for (let i = 0; i < els.length; i++) {
      let pID = els[i].getAttribute("product-id");
      if (!pIDs.includes(pID)) {
        pIDs.push(pID);
        variations.push(-1);
        variationPrices.push(-1);
        quantities.push(1);
      }
    }
    populateDynamicData(pIDs);
    operation = "view_item_list";
    let dlContent = await getDLReadyContent(
      pIDs,
      operation,
      variations,
      variationPrices,
      quantities
    );
    pushToDataLayer(dlContent);
  }

  //checkout
  if (window.location.pathname === "/checkout/") {
    let els = document.querySelectorAll(".ga-wc-product-name");
    if (els.length > 0) {
      let pIDs = [];
      let variations = [];
      let variationPrices = [];
      let quantities = [];

      for (let i = 0; i < els.length; i++) {
        let parentId = els[i].dataset.parentId;
        let productId = els[i].dataset.productId;
        let quantity = els[i].dataset.quantity;
        let price = els[i].dataset.price;

        if (parentId === "0") {
          pIDs.push(productId);
          variations.push(-1);
          variationPrices.push(-1);
        } else {
          pIDs.push(parentId);
          variations.push(productId);
          variationPrices.push(price);
        }
        quantities.push(quantity);
      }

      operation = "begin_checkout";
      let dlContent = await getDLReadyContent(
        pIDs,
        operation,
        variations,
        variationPrices,
        quantities
      );
      pushToDataLayer(dlContent);
    }
  }

  //Order Placed
  if (window.location.pathname.includes("/order-received")) {
    let brokenPath = window.location.pathname.split("/");
    let orderId = brokenPath[3];
    operation = "purchase";
    let orderContent = await getOrderData(orderId);
    let orderContentForDL = prepareOrderData(orderContent);
    let lineItems = orderContent.line_items;
    let pIDs = [];
    let vaiations = [];
    let variationPrices = [];
    let quantities = [];

    for (let i = 0; i < lineItems.length; i++) {
      pIDs.push(lineItems[i].product_id);
      quantities.push(lineItems[i].quantity);
      let variation = lineItems[i].variation_id;

      if (parseInt(variation) > 0) {
        variations.push(variation);
        variationPrices.push(lineItems[i].price);
      } else {
        variations.push(-1);
        variationPrices.push(1);
      }
    }

    let dlContent = await getDLReadyContent(
      pIDs,
      operation,
      variations,
      variationPrices,
      quantities,
      orderContentForDL
    );
    pushToDataLayer(dlContent);
  }
};

async function getOrderData(oID) {
  let need = "/orders/" + oID;
  let data = await fetchFromREST(need, oID);
  return data;
}

function prepareOrderData(orderContent) {
  let order = {};
  order.transaction_id = orderContent.id;
  order.affiliation = "Online Store";
  order.value = orderContent.total;
  order.tax = orderContent.total_tax;
  order.shipping = orderContent.shipping_total;
  order.currency = "USD";
  order.discount_total = orderContent.discount_total;
  order.payment_method = orderContent.payment_method;
  return order;
}

/************** HELPER FUNCTIONS *****************/

function dataLayerOperation() {
  dataLayer.push({
    event: "summary_car_seen",
    page: window.location.pathname,
  });
}

function populateDynamicData(ids) {
  for (let i = 0; i < ids.length; i++) {
    let info = {};
    info.index = i + 1;
    info.item_list_id = window.location.pathname;
    info.item_list_name = window.location.pathname;
    sessionStorage.setItem(ids[i], JSON.stringify(info));
  }
}

async function executeViewItem() {
  let el = document.querySelector(".type-product");
  let htmlELId = el.id;
  let arr = htmlELId.split("-");
  let pID = arr[1];
  let pIDs = [];
  pIDs.push(pID);

  let variations = [];
  let variationPrices = [];
  let variationEl = document.querySelector(".variation_id");
  let variationPricesEl = document.querySelector(
    ".woocommerce-variation-price>.price>.woocommerce-Price-amount"
  );

  if (variationPricesEl) {
    variations.push(variationEl.getAttribute("value"));
    variationPrices.push(variationPricesEl.dataset.price);
  } else {
    variations.push(-1);
    variationPrices.push(-1);
  }
  let quantities = [1];

  let operation = "view_item";
  let dlContent = await getDLReadyContent(
    pIDs,
    operation,
    variations,
    variationPrices,
    quantities
  );
  pushToDataLayer(dlContent);
}

function setCartQuantities() {
  initialQtysInCart = {};
  let qtys = document.querySelectorAll(".qty");

  for (let i = 0; i < qtys.length; i++) {
    let qty = qtys[i].value;
    let qEl = qtys[i].closest(".ga-wc-remove");
    let prodId = qEl.dataset.product_id;
    let variationId = qEl.dataset.variation_id;

    if (variationId === prodId) {
      initialQtysInCart[prodId] = qty;
    } else {
      initialQtysInCart[variationId] = qty;
    }
  }
  console.log(initialQtysInCart);
}

function updateCart() {
  let qtys = document.querySelectorAll(".qty");
  for (let i = 0; i < qtys.length; i++) {
    let qty = qtys[i].value;
    let qEl = qtys[i].closest(".ga-wc-remove");
    let prodId = qEl.dataset.product_id;
    let variationId = qEl.dataset.variation_id;
    let price = qEl.dataset.price;

    let id = parseInt(prodId) === parseInt(variationId) ? prodId : variationId;
    let initq = parseInt(initialQtysInCart[id]);
    let currq = parseInt(qty);

    if (currq > initq) {
      //addtocart
      let operation = "add_to_cart";
      let q = currq - initq;

      updateCartSend(
        parseInt(prodId),
        parseInt(variationId),
        price,
        operation,
        q
      );
    } else if (currq < initq) {
      //removefromcart
      let operation = "remove_from_cart";
      let q = initq - currq;
      updateCartSend(
        parseInt(prodId),
        parseInt(variationId),
        price,
        operation,
        q
      );
    } else {
      //do nothing
    }
  }
}

async function updateCartSend(prodId, variationId, price, operation, q) {
  let pIDs = [];
  let variations = [];
  let quantities = [];
  let variationPrices = [];

  if (prodId === variationId) {
    variations.push(-1);
    variationPrices.push(-1);
  } else {
    variations.push(variationId);
    variationPrices.push(price);
  }
  pIDs.push(prodId);
  quantities.push(q);

  let dlContent = await getDLReadyContent(
    pIDs,
    operation,
    variations,
    variationPrices,
    quantities
  );
  pushToDataLayer(dlContent);
  setCartQuantities();
}

/***************** DATALYER PUSH FRAMEWORK *******************/

function pushToDataLayer(dataReady) {
  dataLayer.push({ ecommerce: null });
  dataLayer.push(dataReady);
}

async function getDLReadyContent(
  pIDs,
  operation,
  variations,
  variationPrices,
  quantities,
  orderContentForDL
) {
  let dataList = [];
  for (let i = 0; i < pIDs.length; i++) {
    //need url
    let need = prepareRESTURL(pIDs[i]);
    //fetch function
    let data = await fetchFromREST(need, pIDs[i]);
    dataList.push(data);
  }
  //format it the way datalayer needs
  let dlContent = structureForDL(
    dataList,
    operation,
    variations,
    variationPrices,
    quantities,
    orderContentForDL
  );
  return dlContent;
}

function prepareRESTURL(pID = -1) {
  let need = "";

  if (pID !== -1) {
    need = "/products/" + pID;
  }
  return need;
}

function structureForDL(
  dataList,
  operation,
  variations,
  variationPrices,
  quantities,
  orderContentForDL
) {
  //create the item object

  let dlItemData = prepareDLItems(
    dataList,
    operation,
    variations,
    variationPrices,
    quantities
  );
  //create the datalayer object
  let dlContent = structureDataForDL(dlItemData, operation, orderContentForDL);
  return dlContent;
}

function structureDataForDL(dlItemData, operation, orderContentForDL) {
  let dlObj = {};
  dlObj.event = operation;
  dlObj.ecommerce = {};
  if (orderContentForDL) {
    dlObj.ecommerce.transaction_id = orderContentForDL.transaction_id;
    dlObj.ecommerce.affiliation = orderContentForDL.affiliation;
    dlObj.ecommerce.value = orderContentForDL.value;
    dlObj.ecommerce.tax = orderContentForDL.tax;
    dlObj.ecommerce.shipping = orderContentForDL.shipping;
    dlObj.ecommerce.currency = orderContentForDL.currency;
    dlObj.ecommerce.coupon = orderContentForDL.coupon;
    dlObj.ecommerce.payment_method = orderContentForDL.payment_method;
  }

  dlObj.ecommerce.items = dlItemData;

  return dlObj;
}

function prepareDLItems(
  dataList,
  operation,
  variations,
  variationPrices,
  quantities
) {
  let items = [];

  for (let i = 0; i < dataList.length; i++) {
    let data = dataList[i];
    let variation = variations[i];
    let price = -1;
    let quantity = quantities[i];

    if (parseInt(variationPrices[i]) !== -1) {
      price = variationPrices[i];
    } else {
      price = data.price;
    }
    let itemListID = "none";
    let itemListName = "none";
    let position = -1;
    let info = sessionStorage.getItem(data.id);

    if (info) {
      info = JSON.parse(info);
      itemListID = info.item_list_id;
      itemListName = info.item_list_name;
      position = info.index;
    }

    let item = {};
    item.item_id = data.id;
    item.item_name = data.name;
    item.affiliation = "Online Store";
    //item.coupon= "SUMMER_FUN";
    item.currency = "USD";
    //item.discount= 2.22;
    item.index = position;
    item.item_brand = "Neel";
    item.item_category = data.categories[0].name;
    item.item_list_id = itemListID;
    item.item_list_name = itemListName;
    item.item_variant = variation;
    item.price = price;
    item.quantity = quantity;
    items.push(item);
  }

  return items;
}

let centralData = {};
async function fetchFromREST(need = "/products", id = -1) {
  if (id > 0 && !need.includes("/order")) {
    let data = centralData[id];
    if (data) {
      console.log(data);
      return data;
    }
  }

  //nonce
  const nonce = getNonceString(9);
  //timestamp
  const ts = Math.floor(new Date().getTime() / 1000);
  //Oauth Signature
  const authType = "HMAC-SHA1";
  // Version
  const version = "1.0";
  //oAuth Signature
  const signature = await generateSignature(ts, nonce, authType, version, need);
  let requestString =
    DOMAIN +
    EXT +
    need +
    "?oauth_consumer_key=" +
    KEY +
    "&oauth_signature_method=" +
    authType +
    "&oauth_timestamp=" +
    ts +
    "&oauth_nonce=" +
    nonce +
    "&oauth_version=" +
    version +
    "&oauth_signature=" +
    signature;

  const requestOptions = {
    method: "GET",
    redirect: "follow",
  };
  let res = await fetch(requestString, requestOptions);
  let resJSON = await res.json();
  console.log(resJSON);

  if (!need.includes("/order")) {
    centralData[resJSON.id] = resJSON;
  }

  return resJSON;
}

// function generateSignature(ts, nonce, authType, version, need) {
// 	const secretPrepared = SECRET + "&";
// 	let base = "GET&"+
// 				encodeURIComponent(DOMAIN + EXT + need) + "&" +
// 				encodeURIComponent("oauth_consumer_key=" + KEY) +
// 				encodeURIComponent("&oauth_nonce=" + nonce) +
// 				encodeURIComponent("&oauth_signature_method=" + authType) +
// 				encodeURIComponent("&oauth_timestamp=" + ts) +
// 				encodeURIComponent("&oauth_version=" + version);
// 	let signature = CryptoJS.HmacSHA1(base, secretPrepared);
// 	let signB64 = signature.toString(CryptoJS.enc.Base64);
// 	return encodeURIComponent(signB64);

// }

async function generateSignature(ts, nonce, authType, version, need) {
  return $.ajax({
    url: "/wp-content/themes/storefront/auth.php",
    data: {
      action: "rest",
      ts: ts,
      nonce: nonce,
      authType: authType,
      version: version,
      need: need,
    },
    type: "post",
    success: function (signature) {
      return signature;
    },
  });
}

function getNonceString(length) {
  let nonce = "";
  const options =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (let i = 0; i < length; i++) {
    nonce += options.charAt(Math.floor(Math.random() * options.length));
  }
  return nonce;
}
