import { createServerFn } from "@tanstack/react-start";
import { SignFramesInput } from "./sign.shared";

export const interpretSignFrames = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SignFramesInput.parse(input))
  .handler(async ({ data }) => {
    const { interpretFrames } = await import("./sign.server");
    return interpretFrames(data);
  });
