import { animationFrame } from "@odoo/hoot-mock";
import { LoadingDataError } from "@spreadsheet/o_spreadsheet/errors";
import { BatchEndpoint, Request, ServerData } from "@spreadsheet/data_sources/server_data";
import { Deferred } from "@web/core/utils/concurrency";
import { describe, expect, test } from "@odoo/hoot";
import { defineSpreadsheetActions, defineSpreadsheetModels } from "../helpers/data";

describe.current.tags("headless");

defineSpreadsheetModels();
defineSpreadsheetActions();

test("simple synchronous get", async () => {
    const orm = {
        call: async (model, method, args) => {
            expect.step(`${model}/${method}`);
            return args[0];
        },
    };
    const serverData = new ServerData(orm, {
        whenDataStartLoading: () => expect.step("data-fetching-notification"),
    });
    expect(() => serverData.get("partner", "get_something", [5])).toThrow(LoadingDataError, {
        message: "it should throw when it's not loaded",
    });
    expect(["partner/get_something", "data-fetching-notification"]).toVerifySteps();
    await animationFrame();
    expect(serverData.get("partner", "get_something", [5])).toBe(5);
    expect([]).toVerifySteps();
});

test("synchronous get which returns an error", async () => {
    const orm = {
        call: async (model, method, args) => {
            expect.step(`${model}/${method}`);
            throw new Error("error while fetching data");
        },
    };
    const serverData = new ServerData(orm, {
        whenDataStartLoading: () => expect.step("data-fetching-notification"),
    });
    expect(() => serverData.get("partner", "get_something", [5])).toThrow(LoadingDataError, {
        message: "it should throw when it's not loaded",
    });
    expect(["partner/get_something", "data-fetching-notification"]).toVerifySteps();
    await animationFrame();
    expect(() => serverData.get("partner", "get_something", [5])).toThrow(Error);
    expect([]).toVerifySteps();
});

test("simple async fetch", async () => {
    const orm = {
        call: async (model, method, args) => {
            expect.step(`${model}/${method}`);
            return args[0];
        },
    };
    const serverData = new ServerData(orm, {
        whenDataStartLoading: () => expect.step("data-fetching-notification"),
    });
    const result = await serverData.fetch("partner", "get_something", [5]);
    expect(result).toBe(5);
    expect(["partner/get_something"]).toVerifySteps();
    expect(await serverData.fetch("partner", "get_something", [5])).toBe(5);
    expect([]).toVerifySteps();
});

test("async fetch which throws an error", async () => {
    const orm = {
        call: async (model, method, args) => {
            expect.step(`${model}/${method}`);
            throw new Error("error while fetching data");
        },
    };
    const serverData = new ServerData(orm, {
        whenDataStartLoading: () => expect.step("data-fetching-notification"),
    });
    expect(serverData.fetch("partner", "get_something", [5])).rejects.toThrow();
    expect(["partner/get_something"]).toVerifySteps();
    expect(serverData.fetch("partner", "get_something", [5])).rejects.toThrow();
    expect([]).toVerifySteps();
});

test("two identical concurrent async fetch", async () => {
    const orm = {
        call: async (model, method, args) => {
            expect.step(`${model}/${method}`);
            return args[0];
        },
    };
    const serverData = new ServerData(orm, {
        whenDataStartLoading: () => expect.step("data-fetching-notification"),
    });
    const [result1, result2] = await Promise.all([
        serverData.fetch("partner", "get_something", [5]),
        serverData.fetch("partner", "get_something", [5]),
    ]);
    expect(["partner/get_something"]).toVerifySteps({
        message: "it should have fetch the data once",
    });
    expect(result1).toBe(5);
    expect(result2).toBe(5);
    expect([]).toVerifySteps();
});

test("batch get with a single item", async () => {
    const deferred = new Deferred();
    const orm = {
        call: async (model, method, args) => {
            await deferred;
            expect.step(`${model}/${method}`);
            return args[0];
        },
    };
    const serverData = new ServerData(orm, {
        whenDataStartLoading: () => expect.step("data-fetching-notification"),
    });
    expect(() => serverData.batch.get("partner", "get_something_in_batch", 5)).toThrow(
        LoadingDataError,
        { message: "it should throw when it's not loaded" }
    );
    await animationFrame(); // wait for the next tick for the batch to be called
    expect(["data-fetching-notification"]).toVerifySteps();
    deferred.resolve();
    await animationFrame();
    expect(["partner/get_something_in_batch"]).toVerifySteps();
    expect(serverData.batch.get("partner", "get_something_in_batch", 5)).toBe(5);
    expect([]).toVerifySteps();
});

test("batch get with multiple items", async () => {
    const orm = {
        call: async (model, method, args) => {
            expect.step(`${model}/${method}`);
            return args[0];
        },
    };
    const serverData = new ServerData(orm, {
        whenDataStartLoading: () => expect.step("data-fetching-notification"),
    });
    expect(() => serverData.batch.get("partner", "get_something_in_batch", 5)).toThrow(
        LoadingDataError,
        { message: "it should throw when it's not loaded" }
    );
    expect(() => serverData.batch.get("partner", "get_something_in_batch", 6)).toThrow(
        LoadingDataError,
        { message: "it should throw when it's not loaded" }
    );
    await animationFrame();
    expect(["partner/get_something_in_batch", "data-fetching-notification"]).toVerifySteps();
    expect(serverData.batch.get("partner", "get_something_in_batch", 5)).toBe(5);
    expect(serverData.batch.get("partner", "get_something_in_batch", 6)).toBe(6);
    expect([]).toVerifySteps();
});

test("batch get with one error", async () => {
    const orm = {
        call: async (model, method, args) => {
            expect.step(`${model}/${method}`);
            if (args[0].includes(5)) {
                throw new Error("error while fetching data");
            }
            return args[0];
        },
    };
    const serverData = new ServerData(orm, {
        whenDataStartLoading: () => expect.step("data-fetching-notification"),
    });
    expect(() => serverData.batch.get("partner", "get_something_in_batch", 4)).toThrow(
        LoadingDataError,
        { message: "it should throw when it's not loaded" }
    );
    expect(() => serverData.batch.get("partner", "get_something_in_batch", 5)).toThrow(
        LoadingDataError,
        { message: "it should throw when it's not loaded" }
    );
    expect(() => serverData.batch.get("partner", "get_something_in_batch", 6)).toThrow(
        LoadingDataError,
        { message: "it should throw when it's not loaded" }
    );
    await animationFrame();
    expect([
        // one call for the batch
        "partner/get_something_in_batch",
        "data-fetching-notification",
        // retries one by one
        "partner/get_something_in_batch",
        "partner/get_something_in_batch",
        "partner/get_something_in_batch",
    ]).toVerifySteps();
    expect(serverData.batch.get("partner", "get_something_in_batch", 4)).toBe(4);
    expect(() => serverData.batch.get("partner", "get_something_in_batch", 5)).toThrow(Error);
    expect(serverData.batch.get("partner", "get_something_in_batch", 6)).toBe(6);
    expect([]).toVerifySteps();
});

test("concurrently fetch then get the same request", async () => {
    const orm = {
        call: async (model, method, args) => {
            expect.step(`${model}/${method}`);
            return args[0];
        },
    };
    const serverData = new ServerData(orm, {
        whenDataStartLoading: () => expect.step("data-fetching-notification"),
    });
    const promise = serverData.fetch("partner", "get_something", [5]);
    expect(() => serverData.get("partner", "get_something", [5])).toThrow(LoadingDataError);
    expect([
        "partner/get_something",
        "partner/get_something",
        "data-fetching-notification",
    ]).toVerifySteps({ message: "it loads the data independently" });
    const result = await promise;
    await animationFrame();
    expect(result).toBe(5);
    expect(serverData.get("partner", "get_something", [5])).toBe(5);
    expect([]).toVerifySteps();
});

test("concurrently get then fetch the same request", async () => {
    const orm = {
        call: async (model, method, args) => {
            expect.step(`${model}/${method}`);
            return args[0];
        },
    };
    const serverData = new ServerData(orm, {
        whenDataStartLoading: () => expect.step("data-fetching-notification"),
    });
    expect(() => serverData.get("partner", "get_something", [5])).toThrow(LoadingDataError);
    const result = await serverData.fetch("partner", "get_something", [5]);
    expect([
        "partner/get_something",
        "data-fetching-notification",
        "partner/get_something",
    ]).toVerifySteps({ message: "it should have fetch the data once" });
    expect(result).toBe(5);
    expect(serverData.get("partner", "get_something", [5])).toBe(5);
    expect([]).toVerifySteps();
});

test("concurrently batch get then fetch the same request", async () => {
    const orm = {
        call: async (model, method, args) => {
            expect.step(`${model}/${method}`);
            return args[0];
        },
    };
    const serverData = new ServerData(orm, {
        whenDataStartLoading: () => expect.step("data-fetching-notification"),
    });
    expect(() => serverData.batch.get("partner", "get_something", 5)).toThrow(LoadingDataError);
    const result = await serverData.fetch("partner", "get_something", [5]);
    await animationFrame();
    expect([
        "partner/get_something",
        "partner/get_something",
        "data-fetching-notification",
    ]).toVerifySteps({ message: "it should have fetch the data once" });
    expect(result).toBe(5);
    expect(serverData.batch.get("partner", "get_something", 5)).toBe(5);
    expect([]).toVerifySteps();
});

test("concurrently get and batch get the same request", async () => {
    const orm = {
        call: async (model, method, args) => {
            expect.step(`${model}/${method}`);
            return args[0];
        },
    };
    const serverData = new ServerData(orm, {
        whenDataStartLoading: () => expect.step("data-fetching-notification"),
    });
    expect(() => serverData.batch.get("partner", "get_something", 5)).toThrow(LoadingDataError);
    expect(() => serverData.get("partner", "get_something", [5])).toThrow(LoadingDataError);
    await animationFrame();
    expect(["partner/get_something", "data-fetching-notification"]).toVerifySteps({
        message: "it should have fetch the data once",
    });
    expect(serverData.get("partner", "get_something", [5])).toBe(5);
    expect(serverData.batch.get("partner", "get_something", 5)).toBe(5);
    expect([]).toVerifySteps();
});

test("Call the correct callback after a batch result", async () => {
    const orm = {
        call: async (model, method, args) => {
            if (args[0].includes(5)) {
                throw new Error("error while fetching data");
            }
            return args[0];
        },
    };
    const batchEndpoint = new BatchEndpoint(orm, "partner", "get_something", {
        whenDataStartLoading: () => {},
        successCallback: () => expect.step("success-callback"),
        failureCallback: () => expect.step("failure-callback"),
    });
    const request = new Request("partner", "get_something", [4]);
    const request2 = new Request("partner", "get_something", [5]);
    batchEndpoint.call(request);
    batchEndpoint.call(request2);
    expect([]).toVerifySteps();
    await animationFrame();
    expect(["success-callback", "failure-callback"]).toVerifySteps();
});
