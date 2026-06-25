const driverAlert = require('./driverAlert.service');

const NotificationAdapter = {
  notifyAdmins(type, title, message, data = {}) {
    return driverAlert.notifyAdmins(type, title, message, data);
  },

  alertDriver(driverId, options) {
    return driverAlert.alertDriver(driverId, options);
  },

  notifyDriverWs(driverId, payload) {
    return driverAlert.notifyDriverWs(driverId, payload);
  },
};

module.exports = NotificationAdapter;
