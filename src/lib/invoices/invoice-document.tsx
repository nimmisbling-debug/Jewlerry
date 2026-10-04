import "server-only";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { OrderDetail } from "@/lib/orders/queries";

const INK = "#2b2420";
const GOLD = "#a8823c";
const MUTED = "#77695c";
const BORDER = "#e5ddd0";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: INK, fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  brand: { fontSize: 20, color: GOLD, fontFamily: "Helvetica-Bold" },
  invoiceMeta: { alignItems: "flex-end" },
  invoiceTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  metaLine: { color: MUTED, marginBottom: 2 },
  section: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  sectionBlock: { width: "48%" },
  sectionLabel: {
    fontSize: 9,
    color: MUTED,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionText: { marginBottom: 2 },
  table: { borderTopWidth: 1, borderTopColor: BORDER, marginBottom: 16 },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 8,
  },
  tableHeaderRow: {
    flexDirection: "row",
    paddingVertical: 6,
    backgroundColor: "#f7f3ec",
  },
  colName: { width: "46%" },
  colQty: { width: "14%", textAlign: "center" },
  colPrice: { width: "20%", textAlign: "right" },
  colTotal: { width: "20%", textAlign: "right" },
  tableHeaderText: { fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 },
  totals: { alignSelf: "flex-end", width: "45%", marginTop: 8 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  totalLabel: { color: MUTED },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
    marginTop: 4,
  },
  grandTotalLabel: { fontFamily: "Helvetica-Bold" },
  grandTotalValue: { fontFamily: "Helvetica-Bold" },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: MUTED,
  },
});

export function InvoiceDocument({ order, storeName }: { order: OrderDetail; storeName: string }) {
  return (
    <Document title={`Invoice ${order.invoiceNumber}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>{storeName}</Text>
          </View>
          <View style={styles.invoiceMeta}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.metaLine}>{order.invoiceNumber}</Text>
            <Text style={styles.metaLine}>Order {order.orderNumber}</Text>
            <Text style={styles.metaLine}>{formatDate(order.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>Billed to</Text>
            <Text style={styles.sectionText}>{order.customerName}</Text>
            <Text style={styles.sectionText}>{order.customerEmail}</Text>
            <Text style={styles.sectionText}>{order.customerPhone}</Text>
          </View>
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>Shipping address</Text>
            <Text style={styles.sectionText}>{order.shippingAddress}</Text>
            {order.shippingCity && <Text style={styles.sectionText}>{order.shippingCity}</Text>}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.colName, styles.tableHeaderText]}>Item</Text>
            <Text style={[styles.colQty, styles.tableHeaderText]}>Qty</Text>
            <Text style={[styles.colPrice, styles.tableHeaderText]}>Unit price</Text>
            <Text style={[styles.colTotal, styles.tableHeaderText]}>Total</Text>
          </View>
          {order.items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.colName}>{item.name}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{formatCurrency(item.unitPrice, order.currencyCode)}</Text>
              <Text style={styles.colTotal}>{formatCurrency(item.lineTotal, order.currencyCode)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text>{formatCurrency(order.subtotal, order.currencyCode)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Shipping</Text>
            <Text>{formatCurrency(order.shippingCost, order.currencyCode)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(order.total, order.currencyCode)}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          This invoice was generated automatically by {storeName} and reflects the order as
          recorded in our system. Thank you for your order.
        </Text>
      </Page>
    </Document>
  );
}
