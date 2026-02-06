export default function(req, res) {
  res.json({ message: 'Hello World', url: req.url });
}
