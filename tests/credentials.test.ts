/**
 * JavaScript and Node.js SDK for OpenFGA
 *
 * API version: 1.x
 * Website: https://openfga.dev
 * Documentation: https://openfga.dev/docs
 * Support: https://openfga.dev/community
 * License: [Apache-2.0](https://github.com/openfga/js-sdk/blob/main/LICENSE)
 */

import axios from "axios";
import * as nock from "nock";

import { Credentials, CredentialsMethod } from "../credentials";
import { TelemetryConfiguration } from "../telemetry/configuration";

nock.disableNetConnect();

describe("Client-secret token-request custom claims", () => {
  const canonicalFields = {
    client_id: "configured-client",
    client_secret: "configured-secret",
    audience: "configured-audience",
    grant_type: "client_credentials",
  };
  const cases: {
    name: string;
    customClaims?: Record<string, string>;
    additionalFields: Record<string, string>;
  }[] = [
    {
      name: "preserves the default form when custom claims are absent",
      additionalFields: {},
    },
    {
      name: "preserves the default form when custom claims are empty",
      customClaims: {},
      additionalFields: {},
    },
    {
      name: "sends additional string fields with form encoding",
      customClaims: {
        organization: "team/one & two",
        scope: "read:tuples",
      },
      additionalFields: {
        organization: "team/one & two",
        scope: "read:tuples",
      },
    },
    {
      name: "keeps all canonical fields ahead of conflicting custom claims",
      customClaims: {
        organization: "team/one & two",
        client_id: "untrusted-client",
        client_secret: "untrusted-secret",
        audience: "untrusted-audience",
        grant_type: "untrusted-grant",
      },
      additionalFields: {
        organization: "team/one & two",
      },
    },
  ];

  afterEach(() => {
    nock.cleanAll();
  });

  it.each(cases)("$name without mutating input or refreshing a cached token", async ({ customClaims, additionalFields }) => {
    const before = customClaims === undefined ? undefined : { ...customClaims };
    if (customClaims !== undefined) {
      Object.freeze(customClaims);
    }
    const tokenRequest = nock("https://token-fields.example", {
      reqheaders: { "Content-Type": "application/x-www-form-urlencoded" },
    })
      .post("/oauth/token", { ...additionalFields, ...canonicalFields })
      .reply(200, { access_token: "token-fields-test", expires_in: 300 });
    const config = {
      clientId: canonicalFields.client_id,
      clientSecret: canonicalFields.client_secret,
      apiAudience: canonicalFields.audience,
      apiTokenIssuer: "token-fields.example",
      ...(customClaims === undefined ? {} : { customClaims }),
    };
    const credentials = Credentials.init({
      credentials: { method: CredentialsMethod.ClientCredentials, config },
      telemetry: new TelemetryConfiguration({}),
    }, axios.create({ proxy: false }));
    const expectedHeader = { name: "Authorization", value: "Bearer token-fields-test" };

    await expect(credentials.getAccessTokenHeader()).resolves.toEqual(expectedHeader);
    await expect(credentials.getAccessTokenHeader()).resolves.toEqual(expectedHeader);
    expect(tokenRequest.isDone()).toBe(true);
    expect(customClaims).toEqual(before);
  });
});
