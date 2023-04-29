import { getServiceEndpoint } from "./service";

export const handleEvent = () => {
  console.log(`Example 1 uses music api URL: ${process.env.MUSIC_API_URL}`);
  console.log(
    `Example 1 uses music api URL from nested file: ${getServiceEndpoint()}`
  );

  return;
};
