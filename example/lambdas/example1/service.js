import { getSubServiceEndpoint } from "./subService";

const getServiceEndpoint = () => {
  console.log(`Example 1 uses notes 2 api URL ${getSubServiceEndpoint()}`);

  return `Example 1 uses notes api URL ${process.env.NOTES_API_URL}`;
};

module.exports = {
  getServiceEndpoint,
};
