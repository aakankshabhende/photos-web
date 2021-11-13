import { File, getLocalFiles } from 'services/fileService';
import DownloadManager from 'services/downloadManager';

import * as tf from '@tensorflow/tfjs-core';
import TSNE from 'tsne-js';
// import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';

// import TFJSFaceDetectionService from './tfjsFaceDetectionService';
// import TFJSFaceEmbeddingService from './tfjsFaceEmbeddingService';
import {
    Cluster,
    ClusterFaces,
    ClusteringResults,
    ClustersWithNoise,
    FaceApiResult,
    FaceDescriptor,
    FaceImage,
    FaceWithEmbedding,
    MLSyncResult,
    NearestCluster,
    TSNEData,
} from 'utils/machineLearning/types';

import * as jpeg from 'jpeg-js';
import ClusteringService from './clusteringService';

import './faceEnvPatch';
import * as faceapi from 'face-api.js';
import { euclideanDistance, SsdMobilenetv1Options } from 'face-api.js';
import { f32Average } from 'utils/machineLearning';
import { RawNodeDatum } from 'react-d3-tree/lib/types/common';

class MachineLearningService {
    // private faceDetectionService: TFJSFaceDetectionService;
    // private faceEmbeddingService: TFJSFaceEmbeddingService;
    private clusteringService: ClusteringService;

    private clusterFaceDistance = 0.4;
    private maxFaceDistance = 0.5;
    private minClusterSize = 4;
    private minFaceSize = 24;
    private batchSize = 50;

    private allFaces: FaceWithEmbedding[];
    private clusteringResults: ClusteringResults;
    private clustersWithNoise: ClustersWithNoise;
    private allFaceImages: FaceImage[];

    public constructor() {
        // this.faceDetectionService = new TFJSFaceDetectionService();
        // this.faceEmbeddingService = new TFJSFaceEmbeddingService();
        this.clusteringService = new ClusteringService();

        this.allFaces = [];
        this.allFaceImages = [];
        this.clusteringResults = {
            clusters: [],
            noise: [],
        };
        this.clustersWithNoise = {
            clusters: [],
            noise: [],
        };
    }

    public async init(
        clusterFaceDistance: number,
        minClusterSize: number,
        minFaceSize: number,
        batchSize: number,
        maxFaceDistance: number
    ) {
        this.clusterFaceDistance = clusterFaceDistance;
        this.minClusterSize = minClusterSize;
        this.minFaceSize = minFaceSize;
        this.batchSize = batchSize;
        this.maxFaceDistance = maxFaceDistance;

        // setWasmPath('/js/tfjs/');
        await tf.ready();

        // await this.faceDetectionService.init();
        // await this.faceEmbeddingService.init();
        console.log('01 TF Memory stats: ', tf.memory());
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models/face-api/');
        // console.log('02 TF Memory stats: ', tf.memory());
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models/face-api/');
        // console.log('03 TF Memory stats: ', tf.memory());
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models/face-api/');
        console.log('04 TF Memory stats: ', tf.memory());
    }

    private getClusterSummary(cluster: ClusterFaces): FaceDescriptor {
        // const faceScore = (f) => f.detection.score; // f.alignedRect.box.width *

        // return cluster
        //     .map((f) => this.allFaces[f].face)
        //     .sort((f1, f2) => faceScore(f2) - faceScore(f1))[0].descriptor;

        const descriptors = cluster.map(
            (f) => this.allFaces[f].face.descriptor
        );

        return f32Average(descriptors);
    }

    private updateClusterSummaries() {
        if (
            !this.clusteringResults ||
            !this.clusteringResults.clusters ||
            this.clusteringResults.clusters.length < 1
        ) {
            return;
        }

        const resultClusters = this.clusteringResults.clusters;

        resultClusters.forEach((resultCluster) => {
            this.clustersWithNoise.clusters.push({
                faces: resultCluster,
                summary: this.getClusterSummary(resultCluster),
            });
        });
    }

    private getNearestCluster(noise: FaceWithEmbedding): NearestCluster {
        let nearest: Cluster = null;
        let nearestDist = 100000;
        this.clustersWithNoise.clusters.forEach((c) => {
            const dist = euclideanDistance(noise.face.descriptor, c.summary);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = c;
            }
        });

        console.log('nearestDist: ', nearestDist);
        return { cluster: nearest, distance: nearestDist };
    }

    private assignNoiseWithinLimit() {
        if (
            !this.clusteringResults ||
            !this.clusteringResults.noise ||
            this.clusteringResults.noise.length < 1
        ) {
            return;
        }

        const noise = this.clusteringResults.noise;

        noise.forEach((n) => {
            const noiseFace = this.allFaces[n];
            const nearest = this.getNearestCluster(noiseFace);

            if (nearest.cluster && nearest.distance < this.maxFaceDistance) {
                console.log('Adding noise to cluser: ', n, nearest.distance);
                nearest.cluster.faces.push(n);
            } else {
                console.log(
                    'No cluster for noise: ',
                    n,
                    'within distance: ',
                    this.maxFaceDistance
                );
                this.clustersWithNoise.noise.push(n);
            }
        });
    }

    private getUniqueFiles(files: File[], limit: number) {
        const uniqueFiles: Map<number, File> = new Map<number, File>();
        for (let i = 0; uniqueFiles.size < limit && i < files.length; i++) {
            if (!uniqueFiles.has(files[i].id)) {
                uniqueFiles.set(files[i].id, files[i]);
            }
        }

        return uniqueFiles;
    }

    public async sync(token: string): Promise<MLSyncResult> {
        if (!token) {
            throw Error('Token needed by ml service to sync file');
        }

        const existingFiles = await getLocalFiles();
        existingFiles.sort(
            (a, b) => b.metadata.creationTime - a.metadata.creationTime
        );
        const files = this.getUniqueFiles(existingFiles, this.batchSize);
        console.log(
            'Got unique files: ',
            files.size,
            'for batchSize: ',
            this.batchSize
        );

        this.allFaces = [];
        for (const file of files.values()) {
            try {
                const result = await this.syncFile(file, token);
                this.allFaces = this.allFaces.concat(result);
                // this.allFaceImages = this.allFaceImages.concat(
                //     result.faceImages
                // );
                console.log('TF Memory stats: ', tf.memory());
            } catch (e) {
                console.error(
                    'Error while syncing file: ',
                    file.id.toString(),
                    e
                );
            }
        }
        console.log('allFaces: ', this.allFaces);
        // console.log('allDescriptors: ', this.allFaces.map(f => Array.from(f.face.descriptor)));

        faceapi.nets.ssdMobilenetv1.dispose();
        // console.log('11 TF Memory stats: ', tf.memory());
        await faceapi.nets.faceLandmark68Net.dispose();
        // console.log('12 TF Memory stats: ', tf.memory());
        await faceapi.nets.faceRecognitionNet.dispose();
        console.log('13 TF Memory stats: ', tf.memory());

        // [0].alignedRect,
        // this.allFaces[0].alignedRect.box,
        // this.allFaces[0].alignedRect.imageDims

        // this.clusteringResults = this.clusteringService.clusterUsingDBSCAN(
        //     this.allFaces.map((f) => Array.from(f.face.descriptor)),
        //     this.clusterFaceDistance,
        //     this.minClusterSize
        // );

        this.clusteringResults = this.clusteringService.clusterUsingHdbscan(
            this.allFaces.map((f) => Array.from(f.face.descriptor))
        );

        // const clusterResults = this.clusteringService.clusterUsingKMEANS(
        //     this.allFaces.map((f) => f.embedding),
        //     10);

        console.log(
            '[MLService] Got cluster results: ',
            this.clusteringResults
        );

        this.updateClusterSummaries();
        this.clustersWithNoise.noise = this.clusteringResults.noise;
        // this.assignNoiseWithinLimit();

        const treeRoot = this.clusteringService.getMST(
            this.allFaces.map((f) => Array.from(f.face.descriptor))
            // this.clusterFaceDistance,
            // this.minClusterSize
        );
        const d3Tree = treeRoot && this.toD3Tree(treeRoot);
        console.log('d3Tree: ', d3Tree);

        const tsne = this.toTSNE();
        console.log('tsne: ', tsne);
        const d3Tsne = tsne && this.toD3Tsne(tsne);
        console.log('d3Tsne: ', d3Tsne);

        return {
            allFaces: this.allFaces,
            clustersWithNoise: this.clustersWithNoise,
            tree: d3Tree,
            tsne: d3Tsne,
        };
    }

    private toD3Tsne(tsne) {
        const data: TSNEData = {
            width: 800,
            height: 800,
            dataset: [],
        };
        data.dataset = tsne.map((t) => {
            return {
                x: (data.width * (t[0] + 1.0)) / 2,
                y: (data.height * (t[1] + 1.0)) / 2,
            };
        });

        return data;
    }

    private toTSNE() {
        const input = this.allFaces.map((f) => Array.from(f.face.descriptor));
        if (!input || input.length < 1) {
            return null;
        }

        const model = new TSNE({
            dim: 2,
            perplexity: 10.0,
            learningRate: 10.0,
            metric: 'euclidean',
        });

        model.init({
            data: input,
            type: 'dense',
        });

        // `error`,  `iter`: final error and iteration number
        // note: computation-heavy action happens here
        model.run();

        // `outputScaled` is `output` scaled to a range of [-1, 1]
        return model.getOutputScaled();
    }

    private toD3Tree(treeNode): RawNodeDatum {
        if (!treeNode.left && !treeNode.right) {
            return {
                name: treeNode.opt[0],
                attributes: {
                    face: treeNode.opt[0],
                },
            };
        }
        const children = [];
        treeNode.left && children.push(this.toD3Tree(treeNode.left));
        treeNode.right && children.push(this.toD3Tree(treeNode.right));

        return {
            name: treeNode.dist,
            children: children,
        };
    }

    private async syncFile(file: File, token: string) {
        if (!token) {
            throw Error('Token needed by ml service to sync file');
        }

        const fileUrl = await DownloadManager.getPreview(file, token);
        console.log('[MLService] Got thumbnail: ', file.id.toString(), fileUrl);

        const thumbFile = await fetch(fileUrl);
        const arrayBuffer = await thumbFile.arrayBuffer();
        const decodedImg = await jpeg.decode(arrayBuffer);
        console.log('[MLService] decodedImg: ', decodedImg);

        // console.log('1 TF Memory stats: ', tf.memory());
        const tfImage = tf.browser.fromPixels(decodedImg);
        // console.log('2 TF Memory stats: ', tf.memory());
        // const faces = await this.faceDetectionService.estimateFaces(tfImage);

        // const embeddingResults = await this.faceEmbeddingService.getEmbeddings(
        //     tfImage,
        //     filtertedFaces
        // );

        // console.log('3 TF Memory stats: ', tf.memory());
        // const faceApiInput = tfImage.expandDims(0) as tf.Tensor4D;
        // tf.dispose(tfImage);
        // console.log('4 TF Memory stats: ', tf.memory());
        const faces = (await faceapi
            .detectAllFaces(
                tfImage as any,
                new SsdMobilenetv1Options({
                    minConfidence: 0.75,
                    // maxResults: 10
                })
            )
            .withFaceLandmarks()
            .withFaceDescriptors()) as FaceApiResult[];

        // console.log('5 TF Memory stats: ', tf.memory());

        const filtertedFaces = faces.filter((face) => {
            return (
                face.alignedRect.box.width > this.minFaceSize // &&
                // face.alignedBox[3] - face.alignedBox[1] > this.minFacePixels
            );
        });
        console.log('filtertedFaces: ', filtertedFaces);

        // const embeddings = results.map(f=>f.descriptor);
        // console.log('embeddings', embeddings);
        let faceImages = [];
        if (filtertedFaces && filtertedFaces.length > 0) {
            const faceBoxes = filtertedFaces
                .map((f) => f.alignedRect.relativeBox)
                .map((b) => [b.top, b.left, b.bottom, b.right]);
            const faceImagesTensor = tf.tidy(() => {
                // const tfImage = tf.browser.fromPixels(decodedImg);
                const faceApiInput = tfImage.expandDims(0) as tf.Tensor4D;
                const normalizedImage = tf.sub(
                    tf.div(faceApiInput, 127.5),
                    1.0
                ) as tf.Tensor4D;
                // console.log('6 TF Memory stats: ', tf.memory());
                return tf.image.cropAndResize(
                    normalizedImage,
                    faceBoxes,
                    tf.fill([faceBoxes.length], 0, 'int32'),
                    [112, 112]
                );
            });
            // console.log('7 TF Memory stats: ', tf.memory());
            faceImages = await faceImagesTensor.array();
            // console.log(JSON.stringify(results));
            // tf.dispose(normalizedImage);
            tf.dispose(faceImagesTensor);
            // tf.dispose(faceApiInput);
        }

        tf.dispose(tfImage);
        // console.log('8 TF Memory stats: ', tf.memory());

        return filtertedFaces.map((ff, index) => {
            return {
                fileId: file.id.toString(),
                face: ff,
                faceImage: faceImages[index],
            } as FaceWithEmbedding;
        });

        // console.log('[MLService] Got faces: ', filtertedFaces, embeddingResults);

        // return filtertedFaces.map((face, index) => {
        //     return {
        //         fileId: file.id.toString(),
        //         face: face,
        //         embedding: embeddingResults.embeddings[index],
        //         faceImage: embeddingResults.faceImages[index],
        //     } as FaceWithEmbedding;
        // });
    }
}

export default MachineLearningService;
