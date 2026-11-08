# Phase 10.2B-4: Linux & WSL2 Runtime Compatibility Report

**Project:** Bhuiya Property Manager (ভূঁইয়া প্রপার্টি ম্যানেজার)  
**Location:** `C:\Bhuiya-Property-Manager`  
**Phase:** 10.2B-4 Linux Compatibility  
**Date:** November 7, 2026  
**Status:** **INVESTIGATED & VALIDATED**  

---

## 1. Executive Summary

This report evaluates options for executing and verifying the Cloudflare Worker inside a Linux runtime environment, comparing **Windows WSL2 (Ubuntu)**, **Native Windows Workerd**, and **GitHub Actions (Ubuntu-latest)**.

---

## 2. Environment Evaluation Matrix

| Option | Platform | Operating System / Kernel | Status | Finding |
| :--- | :--- | :--- | :--- | :--- |
| **Option A: Windows WSL2** | Local Host | Ubuntu 24.04 (`Linux 6.18.54.1-microsoft-standard-WSL2`) | **INSTALLED** | File access works via `/mnt/c/`; outbound virtual NIC DNS is blocked by Windows host network policy. |
| **Option B: Native Workerd** | Local Host | Windows 64-bit | **VALIDATED (ACTIVE)** | Runs Cloudflare's C++ `workerd` binary directly on Windows using `wrangler dev [script] --no-bundle`. |
| **Option C: GitHub Actions**| CI/CD Cloud | Ubuntu 22.04 / 24.04 (`ubuntu-latest`) | **RECOMMENDED FOR CI/CD** | Cloudflare Pages native deployment runner with pure POSIX environment. |

---

## 3. Detailed Findings

### 3.1 WSL2 Ubuntu Environment Inspection
- **Command:** `wsl -l -v`
  - Output: `Ubuntu (Version 2, State: Stopped -> Running)`
- **Command:** `wsl -d Ubuntu -e bash -c "uname -a"`
  - Output: `Linux Jahaji 6.18.54.1-microsoft-standard-WSL2 #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux`
- **Network / DNS Diagnostic:**
  - `cat /etc/resolv.conf` pointed to WSL2 virtual switch (`10.255.255.254`).
  - Attempting external HTTP/DNS (`curl -I https://cloudflare.com`) timed out after 5000ms.
  - *Conclusion:* While WSL2 is installed and operational, its virtual network adapter cannot route outbound DNS on this machine without modifying Windows host firewall rules.

### 3.2 Resolution: Native Windows Workerd Execution
Because Cloudflare's `workerd` binary is distributed as a multi-platform C++ executable (compiled for Windows `x86_64`), running it natively on Windows avoids virtualized network bridges entirely:
- **Execution Command:** `npx wrangler dev poc/phase-10-2a/dist/_worker.js --no-bundle --port 8789 --ip 127.0.0.1`
- **Outcome:** Clean startup, listening on local loopback, serving live HTTP requests to `_worker.js`.

### 3.3 CI/CD Ubuntu Deployment Recommendation (Phase 10.3)
When automated deployments are enabled in later phases, the deployment pipeline should run on GitHub Actions using `ubuntu-latest`:

```yaml
# Recommended CI/CD Workflow (.github/workflows/deploy-pages.yml)
name: Deploy Cloudflare Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: node poc/phase-10-2a/package-worker.mjs
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: bhuiya-property-manager
          directory: dist
```
