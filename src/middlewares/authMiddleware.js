const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token (exclude password)
      let user = await User.findById(decoded.id).select("-password");

      if (!user) {
        res.status(401).json({ message: "User not found" });
        return;
      }

      if (!user.tenant) {
        // Fix for legacy users: Link to existing tenant or create on the fly
        const Tenant = require("../models/Tenant");
        let tenant = await Tenant.findOne({ email: user.email });
        
        if (!tenant) {
          tenant = await Tenant.create({
            name: `${user.name}'s Company`,
            email: user.email,
          });
        }
        
        // Use updateOne to bypass schema validation for missing password
        await User.updateOne({ _id: user._id }, { tenant: tenant._id, role: "superadmin" });
        user.tenant = tenant._id;
        user.role = "superadmin";
      }

      req.user = user;
      next();
    } catch (error) {
      console.error("Auth Middleware Error:", error.message);
      res.status(401).json({ message: "Not authorized: " + error.message });
    }
  }

  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};

module.exports = { protect };
