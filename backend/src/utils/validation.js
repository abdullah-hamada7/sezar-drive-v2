const EMAIL_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]{0,62}[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+$/;
const EGYPT_PHONE_REGEX = /^(?:\+201[0125]\d{8}|01[0125]\d{8})$/;

module.exports = {
  EMAIL_REGEX,
  EGYPT_PHONE_REGEX,
};
