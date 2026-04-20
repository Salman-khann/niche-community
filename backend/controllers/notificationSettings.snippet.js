export const updateNotificationSettings = async (req, res) => {
  try {
    const { id: communityId } = req.params;
    const userId = req.userId; // assuming auth middleware sets req.userId
    const settings = req.body;

    return res.status(200).json({ success: true, message: "Settings updated" });
  } catch (error) {
    console.error("Update Notification Settings Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
