import { registerUser, loginUser } from "../services/auth.service.js";

export const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const { token, user } = await registerUser(name, email, password);

    res.status(201).json({
      success: true,
      token,
      user,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

export const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const { token, user } = await loginUser(email, password);

    res.status(200).json({
      success: true,
      token,
      user,
    });
  } catch (err) {
    res.status(401).json({
      success: false,
      message: err.message,
    });
  }
};
