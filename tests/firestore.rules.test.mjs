import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const projectId = "demo-my-ice-cream-rules";
let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync("firebase/firestore.rules", "utf8"),
    },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

async function seed() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "shops/shop1"), {
      name: "Test Ice Cream",
      ownerUid: "owner-1",
      status: "LIVE",
      minimumOrder: 20,
      pickupAvailable: true,
      deliveryAvailable: false,
      offerTitle: "",
      offerDescription: "",
    });
    await setDoc(doc(db, "shopOwnerLocks/owner-1"), {
      ownerUid: "owner-1",
      shopId: "shop1",
    });
    await setDoc(doc(db, "shops/shop1/products/product1"), {
      shopId: "shop1",
      ownerUid: "owner-1",
      name: "Butter Scotch",
      price: 30,
      description: "",
      category: "Ice Cream",
      imageUrl: "",
      active: true,
    });
    await setDoc(doc(db, "customers/9000000001"), {
      phone: "9000000001",
      name: "Customer One",
      uid: "customer-1",
      registered: true,
    });
    await setDoc(doc(db, "customers/9000000002"), {
      phone: "9000000002",
      name: "Customer Two",
      uid: "customer-2",
      registered: true,
    });
    await setDoc(doc(db, "sales/sale-1"), {
      shopId: "shop1", shopName: "Test Ice Cream", ownerUid: "owner-1",
      customerUid: "customer-1", customerPhone: "9000000001",
      customerName: "Customer One", items: [], subtotal: 0, discount: 0,
      discountType: "amount", total: 0, paymentStatus: "paid",
    });
    await setDoc(doc(db, "sales/sale-2"), {
      shopId: "shop1", shopName: "Test Ice Cream", ownerUid: "owner-1",
      customerUid: "customer-2", customerPhone: "9000000002",
      customerName: "Customer Two", items: [], subtotal: 0, discount: 0,
      discountType: "amount", total: 0, paymentStatus: "paid",
    });
    await setDoc(doc(db, "pushSubscriptions/sub-1"), {
      uid: "customer-1",
      token: "token-customer-one-long-enough-for-rules",
      platform: "web",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });
}

test("a customer can read their own profile but not another customer's profile", async () => {
  await seed();
  const db = testEnv.authenticatedContext("customer-1").firestore();
  await assertSucceeds(getDoc(doc(db, "customers/9000000001")));
  await assertFails(getDoc(doc(db, "customers/9000000002")));
});

test("a customer can read only their own push subscription", async () => {
  await seed();
  const ownDb = testEnv.authenticatedContext("customer-1").firestore();
  const otherDb = testEnv.authenticatedContext("customer-2").firestore();
  await assertSucceeds(getDoc(doc(ownDb, "pushSubscriptions/sub-1")));
  await assertFails(getDoc(doc(otherDb, "pushSubscriptions/sub-1")));
});

test("a live shop owner can read and create a valid product", async () => {
  await seed();
  const db = testEnv.authenticatedContext("owner-1").firestore();
  await assertSucceeds(getDoc(doc(db, "shops/shop1/products/product1")));
  await assertSucceeds(setDoc(doc(db, "shops/shop1/products/product2"), {
    shopId: "shop1",
    ownerUid: "owner-1",
    name: "Vanilla",
    price: 25,
    description: "",
    category: "Ice Cream",
    imageUrl: "",
    active: true,
  }));
});

test("a shop owner cannot change admin-controlled shop status", async () => {
  await seed();
  const db = testEnv.authenticatedContext("owner-1").firestore();
  await assertFails(setDoc(doc(db, "shops/shop1"), {
    status: "inactive",
  }, { merge: true }));
});


test("a customer can submit a UPI order with a valid payment UTR while it remains unpaid", async () => {
  await seed();
  const db = testEnv.authenticatedContext("customer-1").firestore();
  await assertSucceeds(setDoc(doc(db, "orders/upi-order"), {
    shopId: "shop1",
    shopName: "Test Ice Cream",
    deliveryFee: 0,
    subtotal: 30,
    customerUid: "customer-1",
    customerName: "Customer One",
    customerEmail: "customer@example.com",
    customerPhone: "9000000001",
    fulfillmentType: "pickup",
    deliveryAddress: "",
    items: [{ productId: "product1", name: "Butter Scotch", price: 30, quantity: 1 }],
    total: 30,
    status: "placed",
    paymentStatus: "unpaid",
    paymentUtr: "123456789012",
    createdAt: new Date(),
  }));
});

test("a customer cannot submit an online order without a payment UTR", async () => {
  await seed();
  const db = testEnv.authenticatedContext("customer-1").firestore();
  await assertFails(setDoc(doc(db, "orders/missing-utr"), {
    shopId: "shop1",
    shopName: "Test Ice Cream",
    deliveryFee: 0,
    subtotal: 30,
    customerUid: "customer-1",
    customerName: "Customer One",
    customerEmail: "customer@example.com",
    customerPhone: "9000000001",
    fulfillmentType: "pickup",
    deliveryAddress: "",
    items: [{ productId: "product1", name: "Butter Scotch", price: 30, quantity: 1 }],
    total: 30,
    status: "placed",
    paymentStatus: "unpaid",
    createdAt: new Date(),
  }));
});

test("an online order with a forged product price is rejected", async () => {
  await seed();
  const db = testEnv.authenticatedContext("customer-1").firestore();
  await assertFails(setDoc(doc(db, "orders/forged-order"), {
    shopId: "shop1",
    shopName: "Test Ice Cream",
    deliveryFee: 0,
    subtotal: 1,
    customerUid: "customer-1",
    customerName: "Customer One",
    customerEmail: "customer@example.com",
    customerPhone: "9000000001",
    fulfillmentType: "pickup",
    deliveryAddress: "",
    items: [{
      productId: "product1",
      name: "Butter Scotch",
      price: 1,
      quantity: 1,
    }],
    total: 1,
    status: "placed",
    paymentStatus: "unpaid",
    createdAt: new Date(),
  }));
});

test("a customer can register an unused phone number to their own Google account", async () => {
  await seed();
  const db = testEnv.authenticatedContext("customer-3").firestore();
  await assertSucceeds(setDoc(doc(db, "customers/9000000003"), {
    phone: "9000000003",
    name: "Customer Three",
    uid: "customer-3",
    registered: true,
    email: "three@example.com",
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
});

test("a customer cannot register a phone number already linked to another account", async () => {
  await seed();
  const db = testEnv.authenticatedContext("customer-3").firestore();
  await assertFails(setDoc(doc(db, "customers/9000000001"), {
    phone: "9000000001",
    name: "Impersonator",
    uid: "customer-3",
    registered: true,
  }));
});

test("a customer can read only shop bills linked to their Google UID", async () => {
  await seed();
  const ownDb = testEnv.authenticatedContext("customer-1").firestore();
  const otherDb = testEnv.authenticatedContext("customer-2").firestore();
  await assertSucceeds(getDoc(doc(ownDb, "sales/sale-1")));
  await assertFails(getDoc(doc(ownDb, "sales/sale-2")));
  await assertFails(getDoc(doc(otherDb, "sales/sale-1")));
});


test("a valid shop owner can look up one customer profile by exact phone", async () => {
  await seed();
  const db = testEnv.authenticatedContext("owner-1").firestore();
  await assertSucceeds(getDoc(doc(db, "customers/9000000001")));
});

test("a shop owner cannot list the customer directory", async () => {
  await seed();
  const { collection, getDocs } = await import("firebase/firestore");
  const db = testEnv.authenticatedContext("owner-1").firestore();
  await assertFails(getDocs(collection(db, "customers")));
});

test("a signed-in non-shop customer cannot look up another customer's phone profile", async () => {
  await seed();
  const db = testEnv.authenticatedContext("customer-3").firestore();
  await assertFails(getDoc(doc(db, "customers/9000000001")));
});
