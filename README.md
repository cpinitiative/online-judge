# CPI Online Judge on Kubernetes

### Build Docker Images

If you make any edits to source code, you'll need to build and push
a docker image and redeploy. To build, run one of the following commands, depending
on which portion you're trying to build.

```
$ docker build -t grader -f ./src/grader/Dockerfile "."
$ docker build -t server -f ./src/server/Dockerfile "."
```

Next, tag your built images. Make sure to update `v1234` to
the next available increment to allow easy rollbacks. The version increment
does NOT have to be the for both the grader and the server.
To see the current tags, visit [ghcr.io/cpinitiative/ojgrader](https://ghcr.io/cpinitiative/ojgrader) or [ghcr.io/cpinitiative/ojserver](https://ghcr.io/cpinitiative/ojgrader).

```
$ docker tag grader ghcr.io/cpinitiative/ojgrader:v1234
$ docker tag server ghcr.io/cpinitiative/ojserver:v1234
```

Then, [authenticate to the gihtub container registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry#authenticating-to-the-container-registry).
You may wish to save your github personal access token for use in the step "setting docker secrets", which will also require it.

Finally, push your images. Make sure to update `v1234` so it's identical to
what you used before.

```
$ docker push ghcr.io/cpinitiative/ojgrader:v1234
$ docker push ghcr.io/cpinitiative/ojserver:v1234
```

### Connect to the kubernetes cluster

See [https://docs.microsoft.com/en-us/azure/aks/kubernetes-walkthrough#connect-to-the-cluster](https://docs.microsoft.com/en-us/azure/aks/kubernetes-walkthrough#connect-to-the-cluster).

### Setting Docker Secrets

In order to pull the docker image, hosted on github packages, you'll need to
[Setup pulling from Github Packages](https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/).
There are two methods mentioned in this article ([create with existing docker credentials](https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/#registry-secret-existing-credentials)
and [create with cli credentials](https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/#create-a-secret-by-providing-credentials-on-the-command-line)), so if one doesn't work, try the other.
**Regardless of how you do it, the secret with the docker
information should be named `ghcr-cred`**.

### Setting Environment Variable Secrets

The environment variables for the server and the grader are defined as two separate kubernetes secrets.
Before deploying kubernetes, you'll need to set up these secrets. First, download the
serviceAccountKey.json file for the firebase database. Then, find the password for the redis
database. Once you have those two things, run these two commands
in the same directory as the serviceAccountKey.json file from earlier to
set the kubernetes secrets.

```bash
$ kubectl create secret generic environment-variables --from-file=FIREBASE_SERVICE_ACCOUNT=serviceAccountKey.json --from-literal=REDIS_PASSWORD=<password here>
```

### Deploy Changes

#### Updating Image

If kubernetes is already deployed, and you just want to change source code, you can
set the image to use. Make sure to update `v1234` to reflect the docker tag you want to use.

```bash
$ kubectl set image deployments/grader grader=ghcr.io/cpinitiative/ojgrader:v1234
$ kubectl set image deployments/server server=ghcr.io/cpinitiative/ojserver:v1234
```

You can check deployment status with:

```bash
$ kubectl rollout status deployments/grader
$ kubectl rollout status deployments/server
```

#### Rollback

If you want to rollback a deployment, just run:

```bash
$ kubectl rollout undo deployments/grader
$ kubectl rollout undo deployments/server
```

#### Deploying from scratch

If the deployments aren't currently on kubernetes, deploy them with. \*\*Before deploying, make sure the version in kubernetes.yml (typically the :latest docker tag) refers
to the correct docker version, or deploy and then see "Updating Image" above.

```bash
$ kubectl create -f kubernetes.yml
```

## Roadmap

-   CD
