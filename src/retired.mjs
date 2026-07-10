export default function retired(_req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(410).json({
    error: "gone",
    message: "This experimental connector has been retired.",
  });
}
