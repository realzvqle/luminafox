// |jit-test| skip-if: helperThreadCount() === 0
for (let i = 0; i < 15; ++i) {
    evalInWorker("for (var i = 0; i < 100; i++) {}");
}
oomTest(() => {});
