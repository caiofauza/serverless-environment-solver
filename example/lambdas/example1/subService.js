const getSubServiceEndpoint = () => {
  return ` ${process.env.NOTES2_API_URL}`;
};

module.exports = {
  getSubServiceEndpoint,
};
